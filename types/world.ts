// Location description with embedding
export interface Location {
  id: string;
  rawDescription: string;
  embedding: number[];
  clusterId: string | null;
}

// Cluster of similar locations
export interface LocationCluster {
  id: string;
  canonicalName: string;
  centroidEmbedding: number[];
}

// What a character knows
export interface KnowledgeEntry {
  id: string;
  content: string;
  acquiredAt: number; // World time tick
  source: 'witnessed' | 'told' | 'inferred';
  sourceCharacterId?: string;
}

// Relationship between characters
export interface Relationship {
  characterId: string;
  sentiment: number; // -1 to 1
  description: string;
  lastInteraction: number; // World time tick
}

// Character in the world
export interface Character {
  id: string;
  name: string;
  description: string;
  currentLocationClusterId: string;
  knowledge: KnowledgeEntry[];
  relationships: Relationship[];
  isPlayer: boolean;
  isDiscovered: boolean;
  encounterChance: number; // 0-1, chance of being discovered when entering their location
}

// World time (action-based)
export interface WorldTime {
  tick: number;
  narrativeTime: string; // "Late afternoon", "The next morning"
}

// A message in a conversation
export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number; // World time tick
  speakerId?: string; // Character ID who said this
}

// A conversation stream
export interface Conversation {
  id: string;
  type: 'main' | 'offscreen';
  locationClusterId: string;
  participantIds: string[];
  messages: Message[];
  isActive: boolean;
}

// An event that happened in the world
export interface WorldEvent {
  id: string;
  timestamp: number;
  locationClusterId: string;
  involvedCharacterIds: string[];
  description: string;
  witnessedByIds: string[];
  isOffscreen: boolean;
}

// Scenario configuration for starting a new world
export interface ScenarioConfig {
  title: string;
  description: string;
  initialNarrativeTime: string;
  characters: Omit<Character, 'id' | 'knowledge' | 'relationships' | 'isDiscovered'>[];
  startingLocationName: string;
  startingLocationDescription: string;
}

// The entire world state
export interface WorldState {
  id: string;
  scenario: ScenarioConfig;
  time: WorldTime;
  characters: Character[];
  locationClusters: LocationCluster[];
  locations: Location[];
  events: WorldEvent[];
  conversations: Conversation[];
  playerCharacterId: string;
  mainConversationId: string;
}

// Time costs for different actions
export const TIME_COSTS = {
  speak: 1,
  move: 5,
  examine: 2,
  action: 3,
} as const;

export type ActionType = keyof typeof TIME_COSTS;
