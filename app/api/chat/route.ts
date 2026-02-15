import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { openrouter, models } from "@/lib/ai/openrouter";
import type { WorldState } from "@/types/world";
import { analyzePlayerIntent } from "@/lib/chat/action-analyzer";
import {
  executeActions,
  type ActionResult,
} from "@/lib/game/action-executor";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, worldState, modelId, lastSimulationTick } =
    (await req.json()) as {
      messages: UIMessage[];
      worldState: WorldState;
      modelId?: string;
      lastSimulationTick?: number;
    };

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

  // STAGE 1: LOGIC ANALYSIS
  const lastMessage = filteredMessages[filteredMessages.length - 1];
  let actionResults: ActionResult[] = [];

  const isToolResultResponse =
    (lastMessage.role as string) === "tool" ||
    (Array.isArray(lastMessage.parts) &&
      lastMessage.parts.some((p: any) => p.type === "tool-result"));

  console.log(
    "[CHAT API] Received Request. Last Message Role:",
    lastMessage.role,
    "Is Tool Result:",
    isToolResultResponse,
  );

  if (!isToolResultResponse && lastMessage.role === "user") {
    console.log("[CHAT API] Starting Logic Analysis...");
    const analysis = await analyzePlayerIntent(
      await convertToModelMessages(filteredMessages),
      worldState,
      modelId,
    );

    if (analysis.toolCalls && analysis.toolCalls.length > 0) {
      console.log(
        "[CHAT API] Logic Phase detected actions:",
        analysis.toolCalls.map((t) => t.toolName),
      );

      // STAGE 2: EXECUTE ACTIONS SERVER-SIDE
      console.log("[CHAT API] Executing actions server-side...");
      const executionResult = await executeActions(
        analysis.toolCalls,
        worldState,
        lastSimulationTick ?? worldState.time.tick,
        modelId || models.fast,
      );
      actionResults = executionResult.actions;
      console.log(
        "[CHAT API] Actions executed:",
        actionResults.map((a) => a.type),
      );
    } else {
      console.log("[CHAT API] Logic Phase: No actions detected.");
    }
  } else if (isToolResultResponse) {
    console.log("[CHAT API] Processing Tool Result. Skipping Analysis.");
  }

  // STAGE 3: NARRATION (with action results context)
  console.log("[CHAT API] Narrative Phase: generating story.");

  const systemPrompt = buildSystemPrompt(worldState, actionResults);

  const result = streamText({
    model: openrouter(modelId || models.mainConversation),
    system: systemPrompt,
    messages: await convertToModelMessages(filteredMessages),
    tools: {},
    stopWhen: stepCountIs(5),
  });

  // Stream as a data-enriched response: action results + narrative text
  const narrationStream = result.toUIMessageStreamResponse();

  if (actionResults.length === 0) {
    return narrationStream;
  }

  // Prepend action results as a message annotation before the narrative SSE stream
  const encoder = new TextEncoder();
  const originalBody = narrationStream.body;

  if (!originalBody) {
    return narrationStream;
  }

  const transformedStream = new ReadableStream({
    async start(controller) {
      // Send action results as a message annotation using the Vercel AI SDK data stream protocol
      // Format code 8 = message annotation
      const dataLine = `8:${JSON.stringify([{ type: "action_results", results: actionResults }])}\n`;
      controller.enqueue(encoder.encode(dataLine));

      // Pipe through the rest of the narration stream
      const reader = originalBody.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(transformedStream, {
    headers: narrationStream.headers,
  });
}

function buildSystemPrompt(
  world: WorldState,
  actionResults: ActionResult[] = [],
): string {
  const player = world.characters.find(
    (c) => c.id === world.playerCharacterId,
  );
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

  // Build action context for the narrator
  let actionContext = "";
  for (const action of actionResults) {
    if (action.type === "movement") {
      actionContext += `\nACTION: The player is moving to "${action.resolvedCluster.canonicalName}". Describe the new location vividly.`;
      if (action.simulation) {
        const simEvents = action.simulation.events
          .map((e) => e.description)
          .join("; ");
        if (simEvents) {
          actionContext += `\nMeanwhile, elsewhere: ${simEvents}`;
        }
      }
    } else if (action.type === "character_discovery") {
      actionContext += `\nACTION: The player encounters ${action.characterName}. ${action.introduction}`;
    } else if (action.type === "time_advance") {
      actionContext += `\nACTION: Time passes. It is now ${action.narrativeTime}.`;
    }
  }

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
${actionContext ? `\nPENDING ACTIONS:\n${actionContext}\n` : ""}
YOUR ROLE:
- Narrate the world and characters in response to what the player does
- Play the characters present - give them distinct voices and personalities
- Characters should only know what they have witnessed or been told
- When the player moves to a new location, describe it vividly
- Include sensory details and atmosphere
- Keep responses focused and not overly long
- Characters can suggest actions but never force the player
- **IMPORTANT**: The System handles all game state changes (movement, discovery). You observe the state and narrate. If actions are pending above, incorporate them naturally into your narrative.
- Do not hallucinate calling tools. You have no tools.

EXAMPLES:
User: "Who is in the kitchen with me?"
Assistant: [System Action Moves Player] "You walk into the kitchen. Standing there is..."

User: "I look around and see a mysterious woman named Sarah standing in the shadows."
Assistant: [System Action Discovers Sarah] "Sarah steps out of the shadows..."`;
}
