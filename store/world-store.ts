import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  WorldState,
  ScenarioConfig,
  Character,
  LocationCluster,
  Conversation,
  WorldEvent,
  KnowledgeEntry,
} from '@/types/world';
import { api } from '@/lib/api/client';
import { normalizeLocationName } from '@/lib/world/locations';
import { STORAGE_KEYS, getActiveSaveSlot, setActiveSaveSlot } from '@/lib/storage/keys';

function generateId(): string {
  return crypto.randomUUID();
}

interface WorldStore {
  // State
  world: WorldState | null;
  isSimulating: boolean;

  // Actions
  initializeScenario: (config: ScenarioConfig) => void;
  resetWorld: () => void;
  advanceTime: (ticks: number, narrativeTime?: string) => void;
  moveCharacter: (characterId: string, locationClusterId: string) => void;
  addConversation: (conversation: Omit<Conversation, 'id'>) => Conversation;
  addEvent: (event: Omit<WorldEvent, 'id'>) => void;
  updateCharacterKnowledge: (characterId: string, knowledge: Omit<KnowledgeEntry, 'id'>) => void;
  addLocationCluster: (cluster: Omit<LocationCluster, 'id'>) => LocationCluster;
  addCharacter: (character: Omit<Character, 'id'>) => Character;
  updateCharacter: (characterId: string, updates: Partial<Character>) => void;
  discoverCharacter: (characterId: string) => void;
  undiscoverCharacter: (characterId: string) => void;
  setSimulating: (simulating: boolean) => void;
  removeCharactersByCreatorMessageId: (messageId: string) => void;
  removeEventsBySourceId: (messageId: string) => void;
  removeLocationCluster: (clusterId: string) => void;
  removeConversationsBySourceId: (messageId: string) => void;
  removeKnowledgeBySourceId: (messageId: string) => void;
  deduplicateEvents: () => void;
  deduplicateConversations: () => void;
  deduplicateLocationClusters: () => void;

  // Selectors
  getOffscreenConversations: () => Conversation[];
  getCharacterById: (id: string) => Character | null;
  getLocationCluster: (id: string) => LocationCluster | null;
}

export const useWorldStore = create<WorldStore>()(
  persist(
    (set, get) => ({
      world: null,
      isSimulating: false,

      initializeScenario: (config: ScenarioConfig) => {
        // Validate config
        if (!config) {
          throw new Error('Scenario configuration is missing');
        }
        if (!Array.isArray(config.locations) || config.locations.length === 0) {
          throw new Error('Scenario must have at least one location');
        }
        if (!Array.isArray(config.characters)) {
          throw new Error('Scenario characters must be an array');
        }
        if (!config.playerStartingLocation) {
          throw new Error('Scenario must specify a player starting location');
        }

        const worldId = generateId();

        const locationClusters: LocationCluster[] = config.locations.map(loc => ({
          id: generateId(),
          canonicalName: loc.name,
          centroidEmbedding: [],
        }));

        const getLocationId = (name: string) =>
          locationClusters.find(c => c.canonicalName === name)?.id ?? locationClusters[0].id;

        // Verify player starting location exists
        const playerStartingLocationId = locationClusters.find(c => c.canonicalName === config.playerStartingLocation)?.id;

        if (!playerStartingLocationId) {
          throw new Error(`Player starting location "${config.playerStartingLocation}" not found in scenario locations`);
        }

        let playerCharacterId = '';
        const characters: Character[] = config.characters.map((c) => {
          const id = generateId();
          if (c.isPlayer) playerCharacterId = id;

          const locationId = getLocationId(c.initialLocationName);
          const isAtPlayerLocation = locationId === playerStartingLocationId;

          return {
            id,
            name: c.name,
            description: c.description,
            isPlayer: c.isPlayer,
            encounterChance: c.encounterChance,
            currentLocationClusterId: locationId,
            knowledge: [],
            relationships: [],
            isDiscovered: c.isPlayer || isAtPlayerLocation,
            goals: c.goals,
          };
        });

        const world: WorldState = {
          id: worldId,
          scenario: config,
          time: {
            tick: 0,
            narrativeTime: config.initialNarrativeTime,
          },
          characters,
          locationClusters,
          events: [],
          conversations: [],
          playerCharacterId,
        };

        set({ world });
      },

      resetWorld: () => {
        set({ world: null, isSimulating: false });
      },

      advanceTime: (ticks: number, narrativeTime?: string) => {
        set((state) => {
          if (!state.world) return state;
          return {
            world: {
              ...state.world,
              time: {
                tick: state.world.time.tick + ticks,
                narrativeTime: narrativeTime ?? state.world.time.narrativeTime,
              },
            },
          };
        });
      },

      moveCharacter: (characterId: string, locationClusterId: string) => {
        set((state) => {
          if (!state.world) return state;
          return {
            world: {
              ...state.world,
              characters: state.world.characters.map((c) =>
                c.id === characterId
                  ? { ...c, currentLocationClusterId: locationClusterId }
                  : c
              ),
            },
          };
        });
      },

      addConversation: (conversation: Omit<Conversation, 'id'>) => {
        const newConversation: Conversation = {
          ...conversation,
          id: generateId(),
        };
        set((state) => {
          if (!state.world) return state;
          return {
            world: {
              ...state.world,
              conversations: [...state.world.conversations, newConversation],
            },
          };
        });
        return newConversation;
      },

      addEvent: (event: Omit<WorldEvent, 'id'>) => {
        set((state) => {
          if (!state.world) return state;
          const newEvent: WorldEvent = {
            ...event,
            id: generateId(),
          };
          return {
            world: {
              ...state.world,
              events: [...state.world.events, newEvent],
            },
          };
        });
      },

      removeEventsBySourceId: (messageId: string) => {
        set((state) => {
          if (!state.world) return state;
          return {
            world: {
              ...state.world,
              events: state.world.events.filter(
                (e) => e.sourceMessageId !== messageId
              ),
            },
          };
        });
      },

      deduplicateEvents: () => {
        set((state) => {
          if (!state.world) return state;

          const uniqueEvents: WorldEvent[] = [];
          const seen = new Set<string>();

          // Sort by timestamp to keep chronological order
          const sortedEvents = [...state.world.events].sort(
            (a, b) => a.timestamp - b.timestamp
          );

          for (const event of sortedEvents) {
            // Key based on description and timestamp (ignoring ID and internal fields)
            // If two events have the exact same description at the same time, they are dupes
            const key = `${event.timestamp}-${event.description.trim()}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueEvents.push(event);
            }
          }

          return {
            world: {
              ...state.world,
              events: uniqueEvents,
            },
          };
        });
      },

      deduplicateConversations: () => {
        set((state) => {
          if (!state.world) return state;

          const uniqueConversations: Conversation[] = [];
          const seen = new Set<string>();

          for (const conv of state.world.conversations) {
            // Create a signature based on content
            // We care about: location, participants, and the approximate time
            // To be aggressive against "same tick, different text" bugs, we ignore content
            const participantsKey = [...conv.participantIds].sort().join(',');

            // Use time of first message to identify the "session"
            const firstMsg = conv.messages[0];
            const startTime = firstMsg ? firstMsg.timestamp : 0;

            // Signature: Where + Who + When (Start)
            const signature = `${conv.locationClusterId}|${participantsKey}|${startTime}`;

            if (!seen.has(signature)) {
              seen.add(signature);
              uniqueConversations.push(conv);
            }
          }

          return {
            world: {
              ...state.world,
              conversations: uniqueConversations,
            },
          };
        });
      },

      deduplicateLocationClusters: () => {
        set((state) => {
          if (!state.world) return state;

          const winners = new Map<string, LocationCluster>(); // normalized name → first cluster
          const idRemap = new Map<string, string>(); // duplicate ID → winner ID

          for (const cluster of state.world.locationClusters) {
            const normalized = normalizeLocationName(cluster.canonicalName);
            const existing = winners.get(normalized);
            if (existing) {
              idRemap.set(cluster.id, existing.id);
            } else {
              winners.set(normalized, cluster);
            }
          }

          if (idRemap.size === 0) return state;

          return {
            world: {
              ...state.world,
              locationClusters: [...winners.values()],
              characters: state.world.characters.map((c) => {
                const remapped = idRemap.get(c.currentLocationClusterId);
                return remapped ? { ...c, currentLocationClusterId: remapped } : c;
              }),
              events: state.world.events.map((e) => {
                const remapped = idRemap.get(e.locationClusterId);
                return remapped ? { ...e, locationClusterId: remapped } : e;
              }),
              conversations: state.world.conversations.map((c) => {
                const remapped = idRemap.get(c.locationClusterId);
                return remapped ? { ...c, locationClusterId: remapped } : c;
              }),
            },
          };
        });
      },

      updateCharacterKnowledge: (characterId: string, knowledge: Omit<KnowledgeEntry, 'id'>) => {
        set((state) => {
          if (!state.world) return state;
          const character = state.world.characters.find((c) => c.id === characterId);
          if (character?.knowledge.some((k) => k.content === knowledge.content)) {
            return state;
          }
          const newKnowledge: KnowledgeEntry = {
            ...knowledge,
            id: generateId(),
          };
          return {
            world: {
              ...state.world,
              characters: state.world.characters.map((c) =>
                c.id === characterId
                  ? { ...c, knowledge: [...c.knowledge, newKnowledge] }
                  : c
              ),
            },
          };
        });
      },

      addLocationCluster: (cluster: Omit<LocationCluster, 'id'>) => {
        const newCluster: LocationCluster = {
          ...cluster,
          id: generateId(),
        };
        set((state) => {
          if (!state.world) return state;
          return {
            world: {
              ...state.world,
              locationClusters: [...state.world.locationClusters, newCluster],
            },
          };
        });
        return newCluster;
      },

      addCharacter: (character: Omit<Character, 'id'>) => {
        const newCharacter: Character = {
          ...character,
          id: generateId(),
        };
        set((state) => {
          if (!state.world) return state;
          return {
            world: {
              ...state.world,
              characters: [...state.world.characters, newCharacter],
            },
          };
        });
        return newCharacter;
      },

      updateCharacter: (characterId: string, updates: Partial<Character>) => {
        set((state) => {
          if (!state.world) return state;
          return {
            world: {
              ...state.world,
              characters: state.world.characters.map((c) =>
                c.id === characterId ? { ...c, ...updates } : c
              ),
            },
          };
        });
      },

      discoverCharacter: (characterId: string) => {
        set((state) => {
          if (!state.world) return state;
          return {
            world: {
              ...state.world,
              characters: state.world.characters.map((c) =>
                c.id === characterId ? { ...c, isDiscovered: true } : c
              ),
            },
          };
        });
      },

      undiscoverCharacter: (characterId: string) => {
        set((state) => {
          if (!state.world) return state;
          return {
            world: {
              ...state.world,
              characters: state.world.characters.map((c) =>
                c.id === characterId ? { ...c, isDiscovered: false } : c
              ),
            },
          };
        });
      },

      setSimulating: (simulating: boolean) => {
        set({ isSimulating: simulating });
      },

      removeCharactersByCreatorMessageId: (messageId: string) => {
        set((state) => {
          if (!state.world) return state;
          return {
            world: {
              ...state.world,
              characters: state.world.characters.filter(
                (c) => c.createdByMessageId !== messageId
              ),
            },
          };
        });
      },

      removeLocationCluster: (clusterId: string) => {
        set((state) => {
          if (!state.world) return state;
          return {
            world: {
              ...state.world,
              locationClusters: state.world.locationClusters.filter(
                (c) => c.id !== clusterId
              ),
            },
          };
        });
      },

      removeConversationsBySourceId: (messageId: string) => {
        set((state) => {
          if (!state.world) return state;
          return {
            world: {
              ...state.world,
              conversations: state.world.conversations.filter(
                (c) => c.sourceMessageId !== messageId
              ),
            },
          };
        });
      },

      removeKnowledgeBySourceId: (messageId: string) => {
        set((state) => {
          if (!state.world) return state;
          return {
            world: {
              ...state.world,
              characters: state.world.characters.map((c) => ({
                ...c,
                knowledge: c.knowledge.filter(
                  (k) => k.sourceMessageId !== messageId
                ),
              })),
            },
          };
        });
      },

      // Selectors
      getOffscreenConversations: () => {
        const world = get().world;
        if (!world) return [];
        return world.conversations.filter(
          (c) => c.type === 'offscreen' && c.isActive
        );
      },

      getCharacterById: (id: string) => {
        const world = get().world;
        if (!world) return null;
        return world.characters.find((c) => c.id === id) ?? null;
      },

      getLocationCluster: (id: string) => {
        const world = get().world;
        if (!world) return null;
        return world.locationClusters.find((c) => c.id === id) ?? null;
      },

    }),
    {
      name: STORAGE_KEYS.WORLD,
      storage: createJSONStorage(() => {
        let persistenceDebounceTimer: ReturnType<typeof setTimeout> | null = null;

        return {
          getItem: async (name: string): Promise<string | null> => {
            try {
              // Determine the actual key to use
              const activeSlot = getActiveSaveSlot();
              const storageKey = activeSlot ?? name;
              if (!activeSlot) {
                setActiveSaveSlot(name);
              }

              const data = await api.storage.get(storageKey);
              if (data) return JSON.stringify(data);

              // Migration: Check localStorage if API is empty (only for legacy key)
              if (typeof window !== 'undefined' && storageKey === name) {
                const local = localStorage.getItem(name);
                if (local) {
                  // Return local data - it will be saved to API on next update
                  return local;
                }
              }
              return null;
            } catch {
              return null;
            }
          },
          setItem: async (name: string, value: string): Promise<void> => {
            // Debounce the save operation to reduce network requests
            if (persistenceDebounceTimer) {
              clearTimeout(persistenceDebounceTimer);
            }

            // Return immediately to unblock the UI
            // The actual save happens after the debounce delay
            persistenceDebounceTimer = setTimeout(async () => {
              try {
                const parsed = JSON.parse(value);

                // Fix: Do not save if world is null (e.g. when resetting to main menu)
                if (!parsed.state || !parsed.state.world) {
                  return;
                }

                const storageKey = getActiveSaveSlot() ?? name;

                await api.storage.set(storageKey, parsed);
              } catch (e) {
                console.error('Failed to save to API storage', e);
              }
            }, 1000); // 1 second debounce
          },
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          removeItem: async (_name: string): Promise<void> => {
            // No-op for now
          },
        };
      }),
      partialize: (state) => ({ world: state.world }),
    }
  )
);
