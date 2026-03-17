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
  sourceMessageId?: string; // ID of the chat message that produced this knowledge
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
  goals?: string; // Short-term or long-term motivation
  createdByMessageId?: string; // ID of the chat message that created this character
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
  sourceMessageId?: string; // ID of the chat message that triggered this conversation
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
  sourceMessageId?: string; // ID of the chat message that triggered this event
}

// Initial location for scenario setup
export interface InitialLocation {
  name: string;
  description: string;
}

// Character config for scenario setup
export interface CharacterConfig {
  name: string;
  description: string;
  isPlayer: boolean;
  initialLocationName: string; // Must match a location name
  encounterChance: number;
  goals?: string;
}

// Scenario configuration for starting a new world
export interface ScenarioConfig {
  title: string;
  description: string;
  initialNarrativeTime: string;
  locations: InitialLocation[];
  characters: CharacterConfig[];
  playerStartingLocation: string; // Where the player begins
}

// The entire world state
export interface WorldState {
  id: string;
  scenario: ScenarioConfig;
  time: WorldTime;
  characters: Character[];
  locationClusters: LocationCluster[];
  events: WorldEvent[];
  conversations: Conversation[];
  playerCharacterId: string;
}

