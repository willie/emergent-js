import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { openrouter, models } from "@/lib/ai/openrouter";
import { isValidModel } from "@/lib/ai/models";
import type { WorldState } from "@/types/world";
import {
  analyzePlayerIntent,
  type SimpleToolCall,
} from "@/lib/chat/action-analyzer";
import { resolveLocation } from "@/lib/world/locations";
import { findBestCharacterMatch } from "@/lib/chat/tool-processor";
import type { StateDelta, GameMessage } from "@/lib/chat/types";

export const maxDuration = 30;

export async function POST(req: Request) {
  let messages: UIMessage[];
  let worldState: WorldState;
  let rawModelId: string | undefined;
  let lastSimulationTick: number | undefined;

  try {
    const json = await req.json();
    messages = json.messages;
    worldState = json.worldState;
    rawModelId = json.modelId;
    lastSimulationTick = json.lastSimulationTick;
  } catch (error) {
    console.error("[CHAT API] Invalid JSON:", error);
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const modelId =
    rawModelId && isValidModel(rawModelId) ? rawModelId : undefined;

  // Filter out "Continue" messages
  const filteredMessages = messages.filter((m) => {
    const msg = m as any;
    const content = msg.content;
    let isContinue =
      content === "Continue" || content === "__SURAT_CONTINUE__";

    if (!isContinue && Array.isArray(msg.parts)) {
      const textPart = msg.parts.find(
        (p: any) =>
          p.type === "text" &&
          (p.text === "Continue" || p.text === "__SURAT_CONTINUE__"),
      );
      if (textPart) {
        isContinue = true;
      }
    }

    return !(m.role === "user" && isContinue);
  });

  const lastMessage = filteredMessages[filteredMessages.length - 1];
  let stateDelta: StateDelta | undefined;
  let effectiveWorldState = worldState;

  // Analyze player intent and execute tools server-side
  if (lastMessage.role === "user") {
    console.log("[CHAT API] Starting Logic Analysis...");
    const analysis = await analyzePlayerIntent(
      await convertToModelMessages(filteredMessages),
      worldState,
      modelId,
    );

    if (analysis.toolCalls && analysis.toolCalls.length > 0) {
      console.log(
        "[CHAT API] Detected actions:",
        analysis.toolCalls.map((t) => t.toolName),
      );

      stateDelta = await executeTools(
        analysis.toolCalls,
        worldState,
        modelId,
        lastSimulationTick,
      );

      // Apply delta to an in-memory copy so narration reflects post-action state
      effectiveWorldState = applyDeltaToWorldState(worldState, stateDelta);
    } else {
      console.log("[CHAT API] No actions detected.");
    }
  }

  // Stream narration using the (possibly updated) world state
  console.log("[CHAT API] Generating narration.");

  const systemPrompt = buildSystemPrompt(effectiveWorldState);

  const result = streamText({
    model: openrouter(modelId || models.mainConversation),
    system: systemPrompt,
    messages: await convertToModelMessages(filteredMessages),
    tools: {},
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse<GameMessage>({
    messageMetadata: stateDelta ? () => ({ stateDelta }) : undefined,
  });
}

async function executeTools(
  toolCalls: SimpleToolCall[],
  worldState: WorldState,
  modelId?: string,
  lastSimulationTick?: number,
): Promise<StateDelta> {
  const delta: StateDelta = {};
  const player = worldState.characters.find(
    (c) => c.id === worldState.playerCharacterId,
  );

  for (const tool of toolCalls) {
    switch (tool.toolName) {
      case "moveToLocation": {
        const { destination, narrativeTime, accompaniedBy } = tool.args;
        const previousClusterId = player?.currentLocationClusterId;

        const resolved = await resolveLocation(
          destination,
          worldState.locationClusters,
          modelId,
        );

        // Resolve accompanied character IDs
        const accompaniedCharacterIds: string[] = [];
        if (accompaniedBy && Array.isArray(accompaniedBy)) {
          for (const name of accompaniedBy) {
            const match = findBestCharacterMatch(
              name,
              worldState.characters,
            );
            if (match && match.id !== worldState.playerCharacterId) {
              accompaniedCharacterIds.push(match.id);
            }
          }
        }

        delta.movement = {
          destination,
          resolvedClusterId: resolved.clusterId ?? "",
          isNewCluster: resolved.isNew,
          newClusterName: resolved.isNew
            ? resolved.canonicalName
            : undefined,
          previousClusterId,
          accompaniedCharacterIds:
            accompaniedCharacterIds.length > 0
              ? accompaniedCharacterIds
              : undefined,
        };

        // Check if simulation is needed
        const simTick = lastSimulationTick ?? 0;
        const timeSinceLastSim = worldState.time.tick - simTick;
        if (timeSinceLastSim > 5 && previousClusterId !== resolved.clusterId) {
          delta.simulationNeeded = true;
        }

        // Movement always advances time
        delta.timeAdvance = {
          ticks: 5,
          narrativeTime: narrativeTime || undefined,
        };
        break;
      }

      case "advanceTime": {
        const { narrativeTime, ticks } = tool.args;
        delta.timeAdvance = {
          ticks: ticks ?? 5,
          narrativeTime: narrativeTime || undefined,
        };
        break;
      }

      case "discoverCharacter": {
        const { characterName, introduction, goals } = tool.args;
        const match = findBestCharacterMatch(
          characterName,
          worldState.characters,
        );

        if (!delta.discoveries) delta.discoveries = [];
        delta.discoveries.push({
          characterName,
          matchedCharacterId: match?.id ?? null,
          introduction,
          goals: goals || undefined,
        });
        break;
      }
    }
  }

  return delta;
}

/**
 * Applies a StateDelta to a WorldState copy so the narrator sees post-action state.
 */
function applyDeltaToWorldState(
  world: WorldState,
  delta: StateDelta,
): WorldState {
  let updated = { ...world };

  if (delta.timeAdvance) {
    updated = {
      ...updated,
      time: {
        tick: updated.time.tick + delta.timeAdvance.ticks,
        narrativeTime:
          delta.timeAdvance.narrativeTime ?? updated.time.narrativeTime,
      },
    };
  }

  if (delta.movement) {
    let clusterId = delta.movement.resolvedClusterId;

    if (delta.movement.isNewCluster && delta.movement.newClusterName) {
      // Create a temporary cluster ID for the in-memory copy
      // The real cluster ID will be assigned client-side when applying the delta.
      const tempId = `temp-${Date.now()}`;
      clusterId = tempId;
      updated = {
        ...updated,
        locationClusters: [
          ...updated.locationClusters,
          {
            id: tempId,
            canonicalName: delta.movement.newClusterName,
            centroidEmbedding: [],
          },
        ],
      };
    }

    if (clusterId) {
      updated = {
        ...updated,
        characters: updated.characters.map((c) => {
          if (c.id === updated.playerCharacterId) {
            return { ...c, currentLocationClusterId: clusterId };
          }
          if (delta.movement!.accompaniedCharacterIds?.includes(c.id)) {
            return { ...c, currentLocationClusterId: clusterId };
          }
          return c;
        }),
      };
    }
  }

  if (delta.discoveries) {
    for (const disc of delta.discoveries) {
      if (disc.matchedCharacterId) {
        updated = {
          ...updated,
          characters: updated.characters.map((c) =>
            c.id === disc.matchedCharacterId
              ? { ...c, isDiscovered: true }
              : c,
          ),
        };
      }
      // New characters created client-side won't affect narration prompt
      // since the narrator will see the discovery description in the system prompt
    }
  }

  return updated;
}

function buildSystemPrompt(world: WorldState): string {
  const player = world.characters.find((c) => c.id === world.playerCharacterId);
  const playerLocation = world.locationClusters.find(
    (c) => c.id === player?.currentLocationClusterId,
  );

  const presentCharacters = world.characters.filter(
    (c) =>
      !c.isPlayer &&
      c.isDiscovered &&
      c.currentLocationClusterId === player?.currentLocationClusterId,
  );

  const characterDescriptions = presentCharacters
    .map((c) => {
      const knowledgeStr =
        c.knowledge.length > 0
          ? `\n    Knows: ${c.knowledge
              .slice(-3)
              .map((k) => k.content)
              .join("; ")}`
          : "";
      return `- ${c.name}: ${c.description}${knowledgeStr}`;
    })
    .join("\n");

  const recentEvents = world.events
    .slice(-5)
    .map((e) => `- ${e.description}`)
    .join("\n");

  const undiscoveredHere = world.characters.filter(
    (c) =>
      !c.isPlayer &&
      !c.isDiscovered &&
      c.currentLocationClusterId === player?.currentLocationClusterId,
  );

  const undiscoveredHint =
    undiscoveredHere.length > 0
      ? `\nHIDDEN (can be discovered if player looks around or circumstances arise): ${undiscoveredHere.map((c) => c.name).join(", ")}`
      : "";

  const otherLocations = world.locationClusters
    .filter((loc) => loc.id !== player?.currentLocationClusterId)
    .map((loc) => loc.canonicalName)
    .join(", ");

  return `You are the narrator and game master of an interactive narrative experience called "${world.scenario.title}".

SCENARIO: ${world.scenario.description}

CURRENT LOCATION: ${playerLocation?.canonicalName ?? "Unknown"}
OTHER KNOWN LOCATIONS: ${otherLocations || "None yet"}
TIME: ${world.time.narrativeTime} (tick ${world.time.tick})

CHARACTERS PRESENT (SYSTEM STATE):
${characterDescriptions || "(No one else is here)"}
(NOTE: If a character is participating in the conversation but is NOT listed above, they are not yet discovered. You MUST call discoverCharacter for them immediately.)
${undiscoveredHint}

${recentEvents ? `RECENT EVENTS:\n${recentEvents}\n` : ""}

YOUR ROLE:
- Narrate the world and characters in response to what the player does
- Play the characters present - give them distinct voices and personalities
- Characters should only know what they have witnessed or been told
- When the player moves to a new location, describe it vividly
- Include sensory details and atmosphere
- Keep responses focused and not overly long
- Characters can suggest actions but never force the player
- **IMPORTANT**: The System handles all game state changes (movement, discovery). You observe the state and narrate. If the user *just* moved (e.g. you see a 'movement' tool result), describe the new location.
- Do not hallucinate calling tools. You have no tools.

EXAMPLES:
User: "Who is in the kitchen with me?"
Assistant: [System Action Moves Player] "You walk into the kitchen. Standing there is..."

User: "I look around and see a mysterious woman named Sarah standing in the shadows."
Assistant: [System Action Discovers Sarah] "Sarah steps out of the shadows..."`;
}
