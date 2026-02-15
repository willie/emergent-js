import { resolveLocation, extractCanonicalName } from "@/lib/world/locations";
import { simulateOffscreen } from "@/lib/world/simulation";
import {
  normalizeName,
  findBestCharacterMatch,
} from "@/lib/chat/tool-processor";
import type {
  WorldState,
  WorldEvent,
  Conversation,
  Character,
  LocationCluster,
} from "@/types/world";
import type { SimpleToolCall } from "@/lib/chat/action-analyzer";

// ── Result types ─────────────────────────────────────────────────────────────

export interface MovementActionResult {
  type: "movement";
  destination: string;
  resolvedCluster: { canonicalName: string; isNew: boolean };
  clusterId: string | null;
  accompaniedBy?: string[];
  timeCost: number;
  narrativeTime?: string;
  simulation?: {
    events: WorldEvent[];
    conversations: Omit<Conversation, "id">[];
    characterUpdates: { characterId: string; newLocationId: string }[];
  };
}

export interface TimeAdvanceActionResult {
  type: "time_advance";
  narrativeTime: string;
  timeCost: number;
}

export interface CharacterDiscoveryActionResult {
  type: "character_discovery";
  characterName: string;
  introduction: string;
  goals?: string;
  discoveredCharacterId?: string;
  newCharacter?: Omit<Character, "id">;
}

export type ActionResult =
  | MovementActionResult
  | TimeAdvanceActionResult
  | CharacterDiscoveryActionResult;

// ── Executor ─────────────────────────────────────────────────────────────────

export async function executeActions(
  toolCalls: SimpleToolCall[],
  worldState: WorldState,
  lastSimulationTick: number,
  modelId: string,
): Promise<{ actions: ActionResult[]; newLastSimulationTick: number }> {
  const actions: ActionResult[] = [];
  let currentSimulationTick = lastSimulationTick;

  for (const tc of toolCalls) {
    if (tc.toolName === "moveToLocation") {
      const result = await executeMovement(
        tc.args,
        worldState,
        currentSimulationTick,
        modelId,
      );
      if (result.simulation) {
        currentSimulationTick = worldState.time.tick;
      }
      actions.push(result);
    } else if (tc.toolName === "advanceTime") {
      actions.push({
        type: "time_advance",
        narrativeTime: tc.args.narrativeTime ?? worldState.time.narrativeTime,
        timeCost: tc.args.ticks ?? 5,
      });
    } else if (tc.toolName === "discoverCharacter") {
      actions.push(
        executeCharacterDiscovery(tc.args, worldState),
      );
    }
  }

  return { actions, newLastSimulationTick: currentSimulationTick };
}

// ── Movement ─────────────────────────────────────────────────────────────────

async function executeMovement(
  args: { destination: string; narrativeTime?: string; accompaniedBy?: string[] },
  worldState: WorldState,
  lastSimulationTick: number,
  modelId: string,
): Promise<MovementActionResult> {
  const timeCost = 5;
  const { destination, narrativeTime, accompaniedBy } = args;

  // Resolve location
  let resolved = await resolveLocation(
    destination,
    worldState.locationClusters,
    modelId,
  ).catch(() => null);

  if (!resolved) {
    const fallbackName = extractCanonicalName(destination);
    if (fallbackName) {
      resolved = { clusterId: null, canonicalName: fallbackName, isNew: true };
    }
  }

  if (!resolved) {
    // Could not resolve at all — just return a time advance
    return {
      type: "movement",
      destination,
      resolvedCluster: { canonicalName: destination, isNew: false },
      clusterId: null,
      timeCost,
      narrativeTime,
    };
  }

  // Determine if simulation should trigger
  const player = worldState.characters.find(
    (c) => c.id === worldState.playerCharacterId,
  );
  const previousLocationId = player?.currentLocationClusterId;
  const timeSinceLastSimulation = worldState.time.tick - lastSimulationTick;
  const locationChanged = resolved.isNew || resolved.clusterId !== previousLocationId;

  let simulation: MovementActionResult["simulation"] | undefined;

  if (timeSinceLastSimulation > 5 && locationChanged) {
    const targetClusterId = resolved.clusterId ?? "__new__";
    const relevantEvents = worldState.events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 15)
      .reverse();

    try {
      const simResult = await simulateOffscreen(
        worldState,
        targetClusterId,
        timeSinceLastSimulation,
        modelId,
        relevantEvents,
      );

      if (
        simResult.events.length > 0 ||
        simResult.conversations.length > 0 ||
        simResult.characterUpdates.length > 0
      ) {
        // Filter out character updates for characters accompanying the player
        const filteredUpdates = simResult.characterUpdates.filter((update) => {
          const charName = worldState.characters.find(
            (c) => c.id === update.characterId,
          )?.name;
          const isAccompanying = accompaniedBy?.some(
            (n) => normalizeName(n) === normalizeName(charName || ""),
          );
          return !isAccompanying;
        });

        simulation = {
          events: simResult.events,
          conversations: simResult.conversations,
          characterUpdates: filteredUpdates,
        };
      }
    } catch (e) {
      console.error("[ACTION EXECUTOR] Simulation failed:", e);
    }
  }

  return {
    type: "movement",
    destination,
    resolvedCluster: {
      canonicalName: resolved.canonicalName,
      isNew: resolved.isNew,
    },
    clusterId: resolved.clusterId,
    accompaniedBy,
    timeCost,
    narrativeTime,
    simulation,
  };
}

// ── Character Discovery ──────────────────────────────────────────────────────

function executeCharacterDiscovery(
  args: { characterName: string; introduction: string; goals?: string },
  worldState: WorldState,
): CharacterDiscoveryActionResult {
  const match = findBestCharacterMatch(args.characterName, worldState.characters);

  if (match) {
    return {
      type: "character_discovery",
      characterName: args.characterName,
      introduction: args.introduction,
      goals: args.goals,
      discoveredCharacterId: match.id,
    };
  }

  // Need to create a new character — return the template
  const playerLocation = worldState.characters.find(
    (c) => c.id === worldState.playerCharacterId,
  )?.currentLocationClusterId;

  return {
    type: "character_discovery",
    characterName: args.characterName,
    introduction: args.introduction,
    goals: args.goals,
    newCharacter: {
      name: args.characterName,
      description: args.introduction || "A person encountered in the world.",
      isPlayer: false,
      encounterChance: 0,
      currentLocationClusterId:
        playerLocation || worldState.locationClusters[0].id,
      knowledge: [],
      relationships: [],
      isDiscovered: true,
    },
  };
}
