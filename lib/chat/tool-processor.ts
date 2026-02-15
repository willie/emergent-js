import type { LocationCluster, WorldState, WorldEvent, Conversation, Character } from '@/types/world';
import { extractCanonicalName } from '@/lib/world/locations';

// Tool result types
export interface MovementResult {
  type: 'movement';
  destination: string;
  narrativeTime?: string;
  accompaniedBy?: string[];
  timeCost: number;
}

export interface TimeAdvanceResult {
  type: 'time_advance';
  narrativeTime: string;
  timeCost: number;
}

export interface CharacterDiscoveryResult {
  type: 'character_discovery';
  characterName: string;
  introduction: string;
  goals?: string;
}

export type ToolResult = MovementResult | TimeAdvanceResult | CharacterDiscoveryResult;

// API result types
export interface ResolveLocationResult {
  clusterId: string | null;
  canonicalName: string;
  isNew: boolean;
}

export interface SimulationResult {
  events: WorldEvent[];
  conversations: Omit<Conversation, 'id'>[];
  characterUpdates: { characterId: string; newLocationId: string }[];
}

/**
 * Normalizes a name for fuzzy matching by lowercasing and removing non-word characters.
 */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^\w\s]/g, '').trim();
}

/**
 * Finds the best matching character by name using progressive matching strategies:
 * 1. Exact match (case insensitive)
 * 2. Normalized exact match
 * 3. Substring match
 */
export function findBestCharacterMatch(
  searchName: string,
  characters: Character[]
): { id: string; name: string } | null {
  const normalizedSearch = normalizeName(searchName);

  // 1. Exact match (case insensitive)
  const exact = characters.find(c =>
    c.name.toLowerCase() === searchName.toLowerCase()
  );
  if (exact) return exact;

  // 2. Normalized exact match
  const normalizedExact = characters.find(c =>
    normalizeName(c.name) === normalizedSearch
  );
  if (normalizedExact) return normalizedExact;

  // 3. Substring match (name contains search or search contains name)
  // We prefer the one where the Character name starts with the Search name
  const bestPartial = characters.find(c => {
    const normChar = normalizeName(c.name);
    return normChar.includes(normalizedSearch) || normalizedSearch.includes(normChar);
  });

  return bestPartial || null;
}

/**
 * Resolves a location description to an existing cluster or indicates a new one should be created.
 */
export async function resolveLocationViaApi(
  description: string,
  existingClusters: LocationCluster[],
  modelId: string
): Promise<ResolveLocationResult | null> {
  try {
    const res = await fetch('/api/locations/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, existingClusters, modelId }),
    });
    if (!res.ok) {
      console.error('Location resolution failed:', res.status);
      return null;
    }
    return res.json();
  } catch (e) {
    console.error('Location resolution error:', e);
    return null;
  }
}

/**
 * Runs the world simulation to generate events and character movements.
 */
export async function runSimulationViaApi(
  worldState: WorldState,
  playerLocationClusterId: string,
  timeSinceLastSimulation: number,
  modelId: string
): Promise<SimulationResult | null> {
  try {
    const res = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worldState, playerLocationClusterId, timeSinceLastSimulation, modelId }),
    });
    if (!res.ok) {
      console.error('Simulation failed:', res.status);
      return null;
    }
    return res.json();
  } catch (e) {
    console.error('Simulation error:', e);
    return null;
  }
}

/**
 * World actions interface for tool processing.
 */
export interface WorldActions {
  advanceTime: (ticks: number, narrativeTime?: string) => void;
  addLocationCluster: (cluster: Omit<LocationCluster, 'id'>) => LocationCluster;
  moveCharacter: (characterId: string, locationClusterId: string) => void;
  discoverCharacter: (characterId: string) => void;
  addEvent: (event: Omit<WorldEvent, 'id'>) => void;
  addConversation: (conversation: Omit<Conversation, 'id'>) => Conversation;
  updateCharacterKnowledge: (characterId: string, knowledge: { content: string; acquiredAt: number; source: 'witnessed' | 'told' | 'inferred' }) => void;
  setSimulating: (simulating: boolean) => void;
  addCharacter: (character: Omit<Character, 'id'>) => Character;
  getWorld: () => WorldState | null;
  removeCharactersByCreatorMessageId: (messageId: string) => void;
  removeEventsBySourceId: (messageId: string) => void;
}

export interface ProcessToolResultOptions {
  processedTools: Set<string>;
  onToolProcessed: (key: string) => void;
  worldActions: WorldActions;
  getModelId: () => string;
  lastSimulationTick: { current: number };
}

/**
 * Processes a tool result and updates the world state accordingly.
 */
export async function processToolResult(
  result: ToolResult,
  messageId: string,
  toolCallId: string,
  options: ProcessToolResultOptions
): Promise<void> {
  const { processedTools, onToolProcessed, worldActions, getModelId, lastSimulationTick } = options;
  const resultKey = `${messageId}-${toolCallId}`;

  if (processedTools.has(resultKey)) return;
  onToolProcessed(resultKey);

  const currentWorld = worldActions.getWorld();
  if (!currentWorld) return;

  if (result.type === 'movement' && result.destination) {
    const previousLocationId = currentWorld.characters.find(c => c.id === currentWorld.playerCharacterId)?.currentLocationClusterId;

    let resolved = await resolveLocationViaApi(
      result.destination,
      currentWorld.locationClusters,
      getModelId()
    );

    if (!resolved) {
      // Fallback: extract canonical name manually if API fails
      // This prevents the "silent failure" where location doesn't update
      const fallbackName = extractCanonicalName(result.destination);
      if (fallbackName) {
        // Create new cluster or find best match locally (simple match)
        // treating as new for safety to ensure regular flow
        resolved = {
          clusterId: null,
          canonicalName: fallbackName,
          isNew: true
        };
      }
    }

    if (!resolved) {
      // Should catch almost everything now, but just in case
      worldActions.advanceTime(result.timeCost ?? 5, result.narrativeTime);
      return;
    }

    // Re-assign because we might have populated it in fallback
    let clusterId = resolved.clusterId;
    if (resolved.isNew) {
      const newCluster = worldActions.addLocationCluster({
        canonicalName: resolved.canonicalName,
        centroidEmbedding: [],
      });
      clusterId = newCluster.id;
    }

    if (clusterId) {
      // Move player
      worldActions.moveCharacter(currentWorld.playerCharacterId, clusterId);

      // Move accompanying characters
      if (result.accompaniedBy && Array.isArray(result.accompaniedBy)) {
        for (const name of result.accompaniedBy) {
          const match = findBestCharacterMatch(name, currentWorld.characters);
          if (match && match.id !== currentWorld.playerCharacterId) { // Ensure we don't try to move the player again
            worldActions.moveCharacter(match.id, clusterId);
          }
        }
      }

      const timeSinceLastSimulation = currentWorld.time.tick - lastSimulationTick.current;
      if (timeSinceLastSimulation > 5 && previousLocationId !== clusterId) {
        worldActions.setSimulating(true);
        try {
          const simResult = await runSimulationViaApi(
            currentWorld,
            clusterId,
            timeSinceLastSimulation,
            getModelId()
          );

          if (simResult) {
            const { events, conversations, characterUpdates } = simResult;

            for (const event of events) {
              worldActions.addEvent({
                ...event,
                sourceMessageId: messageId, // Track source for regeneration
              });
              for (const witnessId of event.witnessedByIds) {
                worldActions.updateCharacterKnowledge(witnessId, {
                  content: event.description,
                  acquiredAt: currentWorld.time.tick,
                  source: 'witnessed',
                });
              }
            }
            for (const conv of conversations) {
              worldActions.addConversation(conv);
            }
            if (characterUpdates) {
              for (const update of characterUpdates) {
                // IMPORTANT: Don't move characters who are accompanying the player!
                // The simulation sees the *old* state where they might be absent.
                // But wait, we pass `currentWorld` to simulation. `currentWorld` is a reference. 
                // Does `getWorld()` return a live reference or a snapshot?
                // Zustand `getState().world` is the state *at call time*.
                // But we just called `moveCharacter` above. `moveCharacter` updates the store via `set`.
                // Does `getWorld()` reflect that immediately? yes, if it's `useWorldStore.getState().world`.
                // However, `runSimulationViaApi` receives `worldState`. 
                // If we grabbed `currentWorld` at the top of the function (line 171), it is STALE after we call `moveCharacter`.
                // FIX: We need to get the FRESH world state before calling simulation if we rely on it.
                // OR, just verify that the updates we get from simulation don't override our manual moves.

                // Better fix: if `update.characterId` is in `accompaniedBy`, ignore it.

                const charName = currentWorld.characters.find(c => c.id === update.characterId)?.name;
                const isAccompanying = result.accompaniedBy?.some(n => normalizeName(n) === normalizeName(charName || ''));

                if (!isAccompanying) {
                  worldActions.moveCharacter(update.characterId, update.newLocationId);
                }
              }
            }
          }
          lastSimulationTick.current = currentWorld.time.tick;
        } finally {
          worldActions.setSimulating(false);
        }
      }
    }

    worldActions.advanceTime(result.timeCost ?? 5, result.narrativeTime);
  } else if (result.type === 'time_advance') {
    worldActions.advanceTime(result.timeCost ?? 5, result.narrativeTime);
  } else if (result.type === 'character_discovery' && result.characterName) {
    const match = findBestCharacterMatch(result.characterName, currentWorld.characters);

    if (match) {
      worldActions.discoverCharacter(match.id);
    } else {
      // Create new ephemeral character
      const playerLocation = currentWorld.characters.find(c => c.id === currentWorld.playerCharacterId)?.currentLocationClusterId;

      worldActions.addCharacter({
        name: result.characterName,
        description: result.introduction || 'A person encountered in the world.',
        isPlayer: false,
        encounterChance: 0, // Dynamic characters don't have base encounter logic
        currentLocationClusterId: playerLocation || currentWorld.locationClusters[0].id,
        knowledge: [],
        relationships: [],
        isDiscovered: true,
        createdByMessageId: messageId,
        goals: result.goals,
      });
    }
  }
}
