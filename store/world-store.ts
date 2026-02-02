import { create } from 'zustand';
import type {
  WorldState,
  ScenarioConfig,
  Character,
  LocationCluster,
  Message,
  Conversation,
  WorldEvent,
  KnowledgeEntry,
} from '@/types/world';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

interface WorldStore {
  // State
  world: WorldState | null;
  isSimulating: boolean;

  // Actions
  initializeScenario: (config: ScenarioConfig) => void;
  advanceTime: (ticks: number, narrativeTime?: string) => void;
  moveCharacter: (characterId: string, locationClusterId: string) => void;
  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'conversationId'>) => void;
  addConversation: (conversation: Omit<Conversation, 'id'>) => Conversation;
  addEvent: (event: Omit<WorldEvent, 'id'>) => void;
  updateCharacterKnowledge: (characterId: string, knowledge: Omit<KnowledgeEntry, 'id'>) => void;
  addLocationCluster: (cluster: Omit<LocationCluster, 'id'>) => LocationCluster;
  discoverCharacter: (characterId: string) => void;
  setSimulating: (simulating: boolean) => void;

  // Selectors
  getCharactersAtLocation: (clusterId: string) => Character[];
  getPlayerCharacter: () => Character | null;
  getMainConversation: () => Conversation | null;
  getOffscreenConversations: () => Conversation[];
  getCharacterById: (id: string) => Character | null;
  getLocationCluster: (id: string) => LocationCluster | null;
}

export const useWorldStore = create<WorldStore>((set, get) => ({
  world: null,
  isSimulating: false,

  initializeScenario: (config: ScenarioConfig) => {
    const worldId = generateId();
    const mainConversationId = generateId();

    // Create all location clusters
    const locationClusters: LocationCluster[] = config.locations.map(loc => ({
      id: generateId(),
      canonicalName: loc.name,
      centroidEmbedding: [],
    }));

    // Helper to find location by name
    const getLocationId = (name: string) =>
      locationClusters.find(c => c.canonicalName === name)?.id ?? locationClusters[0].id;

    const playerStartingLocationId = getLocationId(config.playerStartingLocation);

    // Create characters
    let playerCharacterId = '';
    const characters: Character[] = config.characters.map((c, index) => {
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
        // Discover characters at player's starting location
        isDiscovered: c.isPlayer || isAtPlayerLocation,
      };
    });

    // Create main conversation with characters at player's location
    const mainConversation: Conversation = {
      id: mainConversationId,
      type: 'main',
      locationClusterId: playerStartingLocationId,
      participantIds: characters
        .filter(c => c.isDiscovered && c.currentLocationClusterId === playerStartingLocationId)
        .map(c => c.id),
      messages: [],
      isActive: true,
    };

    const world: WorldState = {
      id: worldId,
      scenario: config,
      time: {
        tick: 0,
        narrativeTime: config.initialNarrativeTime,
      },
      characters,
      locationClusters,
      locations: [],
      events: [],
      conversations: [mainConversation],
      playerCharacterId,
      mainConversationId,
    };

    set({ world });
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

  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'conversationId'>) => {
    set((state) => {
      if (!state.world) return state;
      const newMessage: Message = {
        ...message,
        id: generateId(),
        conversationId,
      };
      return {
        world: {
          ...state.world,
          conversations: state.world.conversations.map((conv) =>
            conv.id === conversationId
              ? { ...conv, messages: [...conv.messages, newMessage] }
              : conv
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

  updateCharacterKnowledge: (characterId: string, knowledge: Omit<KnowledgeEntry, 'id'>) => {
    set((state) => {
      if (!state.world) return state;
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

  setSimulating: (simulating: boolean) => {
    set({ isSimulating: simulating });
  },

  // Selectors
  getCharactersAtLocation: (clusterId: string) => {
    const world = get().world;
    if (!world) return [];
    return world.characters.filter(
      (c) => c.currentLocationClusterId === clusterId && c.isDiscovered
    );
  },

  getPlayerCharacter: () => {
    const world = get().world;
    if (!world) return null;
    return world.characters.find((c) => c.id === world.playerCharacterId) ?? null;
  },

  getMainConversation: () => {
    const world = get().world;
    if (!world) return null;
    return world.conversations.find((c) => c.id === world.mainConversationId) ?? null;
  },

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
}));
