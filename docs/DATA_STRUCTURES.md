# Data Structures Reference

This document describes every data structure used in EmergentJS, an AI-powered interactive narrative engine. Data structures are organized by domain: world model, scenario configuration, AI/chat pipeline, simulation engine, state management, and storage.

---

## Table of Contents

- [World Model](#world-model)
  - [WorldState](#worldstate)
  - [Character](#character)
  - [LocationCluster](#locationcluster)
  - [Location](#location)
  - [WorldEvent](#worldevent)
  - [Conversation](#conversation)
  - [Message](#message)
  - [WorldTime](#worldtime)
  - [KnowledgeEntry](#knowledgeentry)
  - [Relationship](#relationship)
- [Scenario Configuration](#scenario-configuration)
  - [ScenarioConfig](#scenarioconfig)
  - [InitialLocation](#initiallocation)
  - [CharacterConfig](#characterconfig)
  - [ScenarioDefinition (Zod Schema)](#scenariodefinition-zod-schema)
- [AI & Chat Pipeline](#ai--chat-pipeline)
  - [AnalyzerResult](#analyzerresult)
  - [SimpleToolCall](#simpletoolcall)
  - [Game Tools (OpenAI Function Schema)](#game-tools-openai-function-schema)
  - [Chat API Request Body](#chat-api-request-body)
- [Tool Processing](#tool-processing)
  - [ToolResult (Union Type)](#toolresult-union-type)
  - [MovementResult](#movementresult)
  - [TimeAdvanceResult](#timeadvanceresult)
  - [CharacterDiscoveryResult](#characterdiscoveryresult)
  - [ResolveLocationResult](#resolvelocationresult)
  - [SimulationResult](#simulationresult)
  - [WorldActions](#worldactions)
  - [ProcessToolResultOptions](#processtoolresultoptions)
- [Simulation Engine](#simulation-engine)
  - [SimulationDepth](#simulationdepth)
  - [Full Simulation Result](#full-simulation-result)
  - [Offscreen Simulation Result](#offscreen-simulation-result)
  - [reportSimulation Tool Schema](#reportsimulation-tool-schema)
- [State Management (Zustand Stores)](#state-management-zustand-stores)
  - [WorldStore](#worldstore)
  - [SettingsStore](#settingsstore)
- [Storage & Persistence](#storage--persistence)
  - [STORAGE_KEYS](#storage_keys)
  - [UseChatPersistenceOptions](#usechatpersistenceoptions)
  - [UseChatPersistenceResult](#usechatpersistenceresult)
  - [Storage API Payloads](#storage-api-payloads)
- [Constants & Enumerations](#constants--enumerations)
  - [TIME_COSTS](#time_costs)
  - [ActionType](#actiontype)
  - [AVAILABLE_MODELS](#available_models)
  - [AvailableModel](#availablemodel)
  - [Model Task Map](#model-task-map)

---

## World Model

These structures represent the complete state of the narrative world at any point in time. Defined in `types/world.ts`.

### WorldState

The root data structure containing the entire game world. Every other world model structure is nested within or referenced by this object.

```typescript
interface WorldState {
  id: string;                        // Unique identifier for this world instance
  scenario: ScenarioConfig;          // The scenario configuration that initialized this world
  time: WorldTime;                   // Current world time (tick-based + narrative)
  characters: Character[];           // All characters in the world (player and NPCs)
  locationClusters: LocationCluster[]; // All known location groupings
  locations: Location[];             // Raw location descriptions with embeddings
  events: WorldEvent[];              // History of significant events
  conversations: Conversation[];     // All conversations (main + offscreen)
  playerCharacterId: string;         // ID of the player's character
  mainConversationId: string;        // ID of the primary player conversation
}
```

**Usage:** Persisted via Zustand to the `/api/storage` endpoint. Passed to API routes (`/api/chat`, `/api/simulate`) as request body context. Serves as the single source of truth for the entire game.

---

### Character

Represents any entity in the world — the player or an NPC. Characters have their own knowledge, relationships, locations, and goals.

```typescript
interface Character {
  id: string;                        // Unique identifier (UUID)
  name: string;                      // Display name
  description: string;               // Physical/personality description for the narrator
  currentLocationClusterId: string;  // ID of the LocationCluster where this character is
  knowledge: KnowledgeEntry[];       // What this character knows
  relationships: Relationship[];     // How this character feels about others
  isPlayer: boolean;                 // True if this is the player character
  isDiscovered: boolean;             // Whether the player knows this character exists
  encounterChance: number;           // 0–1, probability of being discovered when the player enters their location
  goals?: string;                    // Short-term or long-term motivation driving behavior
  createdByMessageId?: string;       // ID of the chat message that dynamically created this character
}
```

**Key behaviors:**
- Characters with `isDiscovered: false` are hidden from the player's view but exist in the simulation. They appear in narrator hints as "HIDDEN" characters.
- `createdByMessageId` tracks dynamically-created characters so they can be removed if the originating message is regenerated.
- NPCs at the player's starting location are auto-discovered during scenario initialization.

---

### LocationCluster

A semantic grouping of location descriptions. Multiple raw descriptions (e.g., "the cafe", "that coffee place") can map to a single canonical cluster.

```typescript
interface LocationCluster {
  id: string;                  // Unique identifier (UUID)
  canonicalName: string;       // The display name (e.g., "Coffee Shop")
  centroidEmbedding: number[]; // Embedding vector for semantic matching (currently unused, initialized empty)
}
```

**Usage:** The primary location reference throughout the system. Characters reference clusters via `currentLocationClusterId`. New clusters are created when the LLM determines a player's destination doesn't match any existing location.

---

### Location

A raw location description with its embedding vector. Maps to a `LocationCluster` for deduplication.

```typescript
interface Location {
  id: string;                    // Unique identifier
  rawDescription: string;        // The original text description
  embedding: number[];           // Embedding vector for semantic similarity
  clusterId: string | null;      // ID of the LocationCluster this belongs to, or null if unassigned
}
```

**Usage:** Part of the location resolution pipeline. Currently the `locations` array in `WorldState` is initialized empty — location resolution happens via LLM tool calls rather than embedding-based clustering.

---

### WorldEvent

A record of something significant that happened in the world. Events form the narrative history and are used to inform both the narrator and the simulation engine.

```typescript
interface WorldEvent {
  id: string;                      // Unique identifier (UUID)
  timestamp: number;               // World tick when the event occurred
  locationClusterId: string;       // Where the event happened
  involvedCharacterIds: string[];  // Characters who participated
  description: string;             // Human-readable description of what happened
  witnessedByIds: string[];        // Characters who saw/know about this event
  isOffscreen: boolean;            // True if this happened during off-screen simulation
  sourceMessageId?: string;        // Chat message ID that triggered this event (for regeneration cleanup)
}
```

**Key behaviors:**
- Events are deduplicated by `timestamp + description` to prevent duplicate entries from re-processing.
- `witnessedByIds` drives knowledge propagation — witnesses get `KnowledgeEntry` records added automatically.
- `sourceMessageId` allows cleanup when the user regenerates a response.

---

### Conversation

A stream of messages between participants. Conversations are either the main player interaction or off-screen NPC dialogues.

```typescript
interface Conversation {
  id: string;                  // Unique identifier (UUID)
  type: 'main' | 'offscreen'; // Whether this is the player's conversation or a simulation
  locationClusterId: string;   // Where this conversation takes place
  participantIds: string[];    // Character IDs involved
  messages: Message[];         // Ordered list of messages
  isActive: boolean;           // Whether this conversation is still ongoing
}
```

**Key behaviors:**
- Exactly one conversation has `type: 'main'` — the player's primary narrative thread.
- Off-screen conversations are generated by the simulation engine and displayed in the OffscreenPanel UI.
- Deduplication uses a signature of `locationClusterId + sorted participantIds + first message timestamp`.

---

### Message

A single utterance or action within a conversation.

```typescript
interface Message {
  id: string;              // Unique identifier (UUID)
  conversationId: string;  // ID of the parent Conversation
  role: 'user' | 'assistant' | 'system'; // Who sent this message
  content: string;         // The text content
  timestamp: number;       // World tick when this was said
  speakerId?: string;      // Character ID of the speaker (for NPC dialogue attribution)
}
```

**Note:** This is the internal world model `Message`, distinct from the Vercel AI SDK's `UIMessage` type used for the chat interface. The `speakerId` field enables the UI to attribute off-screen dialogue lines to specific characters.

---

### WorldTime

The dual-clock time system combining deterministic ticks with narrative descriptions.

```typescript
interface WorldTime {
  tick: number;            // Integer counter incremented by actions (deterministic)
  narrativeTime: string;   // Human-readable time (e.g., "Late afternoon", "The next morning")
}
```

**Design rationale:** Ticks provide a reliable numeric basis for simulation triggers and event ordering. Narrative time gives the LLM a story-appropriate sense of when things happen. The two are updated independently — ticks always advance by a fixed cost, while narrative time is set by the LLM based on story context.

---

### KnowledgeEntry

A piece of information that a character has learned.

```typescript
interface KnowledgeEntry {
  id: string;                          // Unique identifier (UUID)
  content: string;                     // What the character knows
  acquiredAt: number;                  // World tick when learned
  source: 'witnessed' | 'told' | 'inferred'; // How the character learned this
  sourceCharacterId?: string;          // Who told them (if source is 'told')
}
```

**Usage:** Knowledge entries are appended when characters witness events (via simulation) or are told information. The narrator's system prompt includes each present character's last 3 knowledge entries so the LLM can write informed dialogue.

---

### Relationship

How one character feels about another.

```typescript
interface Relationship {
  characterId: string;     // The other character in the relationship
  sentiment: number;       // -1 (hostile) to 1 (friendly)
  description: string;     // Qualitative description (e.g., "Suspicious of their motives")
  lastInteraction: number; // World tick of last interaction
}
```

**Usage:** Fed into the simulation engine's prompts so off-screen character interactions respect existing relationship dynamics.

---

## Scenario Configuration

These structures define the initial setup of a new game world. Defined in `types/world.ts` and validated in `types/scenario.ts`.

### ScenarioConfig

The blueprint for creating a new world. Contains all information needed to initialize `WorldState`.

```typescript
interface ScenarioConfig {
  title: string;                    // Scenario display name (e.g., "Noir Detective")
  description: string;              // Setting and premise for narrator context
  initialNarrativeTime: string;     // Starting time description (e.g., "A rainy Tuesday evening")
  locations: InitialLocation[];     // Starting locations
  characters: CharacterConfig[];    // Starting characters
  playerStartingLocation: string;   // Name of the location where the player begins (must match a location name)
}
```

---

### InitialLocation

A location defined in the scenario setup.

```typescript
interface InitialLocation {
  name: string;         // Canonical name (becomes LocationCluster.canonicalName)
  description: string;  // Flavor text for the location
}
```

---

### CharacterConfig

A character defined in the scenario setup.

```typescript
interface CharacterConfig {
  name: string;                // Character name
  description: string;         // Physical/personality description
  isPlayer: boolean;           // Whether this is the player character
  initialLocationName: string; // Must match an InitialLocation.name
  encounterChance: number;     // 0–1, chance of discovery
  goals?: string;              // Character motivation
}
```

---

### ScenarioDefinition (Zod Schema)

Runtime validation schemas for scenario data, defined in `types/scenario.ts`. These mirror the TypeScript interfaces above but enforce constraints at runtime.

```typescript
const InitialLocationSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

const CharacterConfigSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  isPlayer: z.boolean(),
  initialLocationName: z.string().min(1),
  encounterChance: z.number().min(0).max(1),
  goals: z.string().optional(),
});

const ScenarioSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  initialNarrativeTime: z.string().min(1),
  locations: z.array(InitialLocationSchema).min(1),
  characters: z.array(CharacterConfigSchema).min(1),
  playerStartingLocation: z.string().min(1),
});

type ScenarioDefinition = z.infer<typeof ScenarioSchema>;
```

**Usage:** Used by `ScenarioImportDialog` to validate user-imported scenario JSON files before initializing a world.

---

## AI & Chat Pipeline

These structures support the 3-stage chat pipeline: Logic Analysis, Action Execution, and Narration. Defined in `lib/chat/action-analyzer.ts`.

### AnalyzerResult

The output of Stage 1 (Logic Analysis), indicating what game actions the player's input implies.

```typescript
interface AnalyzerResult {
  toolCalls: SimpleToolCall[];  // List of game actions to execute
  context: string;              // Additional context (currently unused, always empty string)
}
```

---

### SimpleToolCall

A simplified representation of an LLM tool call, extracted from the OpenAI response format.

```typescript
interface SimpleToolCall {
  toolName: string;    // One of: 'moveToLocation', 'advanceTime', 'discoverCharacter'
  args: any;           // Tool-specific arguments (see Game Tools below)
  toolCallId: string;  // Unique ID from the OpenAI API response
}
```

---

### Game Tools (OpenAI Function Schema)

The three game action tools defined as OpenAI function-calling schemas in `GAME_TOOLS_CUSTOM_SCHEMA`. These are raw JSON Schema objects (not Zod) to avoid SDK compatibility issues.

#### moveToLocation

Called when the player moves to a different location.

```typescript
{
  destination: string;      // Brief description of where they are going
  narrativeTime: string;    // New narrative time description ("" if unchanged)
  accompaniedBy: string[];  // Names of characters explicitly moving with the player
}
```

#### advanceTime

Called when significant time passes without movement.

```typescript
{
  narrativeTime: string;  // New narrative time description
  ticks: number;          // How many time units pass (default: 5)
}
```

#### discoverCharacter

Called when the player encounters or notices a new character.

```typescript
{
  characterName: string;  // Name of the character being discovered
  introduction: string;   // How they are introduced or noticed
  goals: string;          // Inferred or stated goals ("" if unknown)
}
```

---

### Chat API Request Body

The payload sent to `POST /api/chat`.

```typescript
{
  messages: UIMessage[];       // Full chat history (Vercel AI SDK UIMessage format)
  worldState: WorldState;      // Current world state snapshot
  modelId?: string;            // Optional model override
}
```

**Note:** `UIMessage` is imported from `@ai-sdk/react` and is the Vercel AI SDK's message format, distinct from the internal `Message` type.

---

## Tool Processing

These structures handle the execution of game actions and their side effects. Defined in `lib/chat/tool-processor.ts`.

### ToolResult (Union Type)

A discriminated union representing the result of processing a game tool call. The `type` field determines which variant is active.

```typescript
type ToolResult = MovementResult | TimeAdvanceResult | CharacterDiscoveryResult;
```

---

### MovementResult

Result of a `moveToLocation` tool call.

```typescript
interface MovementResult {
  type: 'movement';           // Discriminator
  destination: string;        // Where the player is going
  narrativeTime?: string;     // Updated time description
  accompaniedBy?: string[];   // Characters moving with the player
  timeCost: number;           // Ticks consumed by this action
}
```

**Side effects:** Resolves destination to a `LocationCluster` (creating one if new), moves the player and companions, triggers off-screen simulation if enough time has passed and the location changed.

---

### TimeAdvanceResult

Result of an `advanceTime` tool call.

```typescript
interface TimeAdvanceResult {
  type: 'time_advance';     // Discriminator
  narrativeTime: string;    // Updated time description
  timeCost: number;         // Ticks consumed
}
```

---

### CharacterDiscoveryResult

Result of a `discoverCharacter` tool call.

```typescript
interface CharacterDiscoveryResult {
  type: 'character_discovery'; // Discriminator
  characterName: string;       // Name of the discovered character
  introduction: string;        // How they were introduced
  goals?: string;              // Their known goals
}
```

**Side effects:** If the character already exists (matched by name), sets `isDiscovered: true`. If not found, creates a new `Character` at the player's current location with `createdByMessageId` set for cleanup tracking.

---

### ResolveLocationResult

Response from the `POST /api/locations/resolve` endpoint.

```typescript
interface ResolveLocationResult {
  clusterId: string | null;  // Matched cluster ID, or null if new
  canonicalName: string;     // Best canonical name for this location
  isNew: boolean;            // Whether a new LocationCluster should be created
}
```

---

### SimulationResult

Response from the `POST /api/simulate` endpoint.

```typescript
interface SimulationResult {
  events: WorldEvent[];                                    // Significant events that occurred
  conversations: Omit<Conversation, 'id'>[];              // Off-screen dialogues (IDs assigned client-side)
  characterUpdates: { characterId: string; newLocationId: string }[]; // Characters that moved
}
```

---

### WorldActions

An interface abstracting the world state mutations needed by the tool processor. Decouples tool processing from the Zustand store implementation.

```typescript
interface WorldActions {
  advanceTime: (ticks: number, narrativeTime?: string) => void;
  addLocationCluster: (cluster: Omit<LocationCluster, 'id'>) => LocationCluster;
  moveCharacter: (characterId: string, locationClusterId: string) => void;
  discoverCharacter: (characterId: string) => void;
  addEvent: (event: Omit<WorldEvent, 'id'>) => void;
  addConversation: (conversation: Omit<Conversation, 'id'>) => Conversation;
  updateCharacterKnowledge: (characterId: string, knowledge: {
    content: string;
    acquiredAt: number;
    source: 'witnessed' | 'told' | 'inferred';
  }) => void;
  setSimulating: (simulating: boolean) => void;
  addCharacter: (character: Omit<Character, 'id'>) => Character;
  getWorld: () => WorldState | null;
}
```

---

### ProcessToolResultOptions

Configuration object passed to the `processToolResult` function.

```typescript
interface ProcessToolResultOptions {
  processedTools: Set<string>;             // Set of already-processed tool keys (prevents double-processing)
  onToolProcessed: (key: string) => void;  // Callback to mark a tool as processed
  worldActions: WorldActions;              // World mutation interface
  getModelId: () => string;               // Returns the current LLM model ID
  lastSimulationTick: { current: number }; // Mutable ref tracking the last simulation tick
}
```

---

## Simulation Engine

These structures power the off-screen character simulation. Defined in `lib/world/simulation.ts`.

### SimulationDepth

Controls how thoroughly character interactions are simulated based on elapsed time.

```typescript
type SimulationDepth = 'full' | 'summary' | 'skip';
```

| Value     | Condition                                        | Behavior                                |
|-----------|--------------------------------------------------|-----------------------------------------|
| `skip`    | Less than 5 ticks since last interaction         | No simulation                           |
| `summary` | 10–20 ticks since last interaction               | LLM generates a 1–2 sentence summary   |
| `full`    | More than 20 ticks, or unresolved plot points    | Full dialogue generation + event extraction |

---

### Full Simulation Result

The return value of `runFullSimulation()`, representing a complete off-screen dialogue between characters.

```typescript
{
  events: WorldEvent[];       // Significant events extracted from the dialogue
  messages: Message[];        // Parsed dialogue lines
  conversation: Omit<Conversation, 'id'>; // The conversation record (ID assigned later)
  movements: { characterId: string; newLocationId: string }[]; // Characters that decided to leave
}
```

---

### Offscreen Simulation Result

The return value of `simulateOffscreen()`, aggregating results across all location groups.

```typescript
{
  events: WorldEvent[];                                    // All significant events
  conversations: Omit<Conversation, 'id'>[];              // All off-screen conversations
  characterUpdates: { characterId: string; newLocationId: string }[]; // All character movements
}
```

---

### reportSimulation Tool Schema

A Zod-validated tool schema used internally by the simulation engine to extract structured data from generated dialogue text.

```typescript
z.object({
  events: z.array(z.object({
    description: z.string(),        // Brief description of what happened
    isSignificant: z.boolean(),     // Whether this is plot-relevant
  })),
  movements: z.array(z.object({
    characterName: z.string(),      // Who is moving
    destination: z.string(),        // Where they are going
  })).optional(),
})
```

**Usage:** After the LLM generates a dialogue between NPCs, a second (fast) LLM call uses this tool to extract structured events and movements from the raw text.

---

## State Management (Zustand Stores)

The application uses two Zustand stores for client-side state management.

### WorldStore

The primary state store managing the entire game world. Defined in `store/world-store.ts`.

```typescript
interface WorldStore {
  // State
  world: WorldState | null;   // The world (null when no game is active)
  isSimulating: boolean;      // Whether off-screen simulation is running

  // Actions (mutations)
  initializeScenario: (config: ScenarioConfig) => void;
  resetWorld: () => void;
  advanceTime: (ticks: number, narrativeTime?: string) => void;
  moveCharacter: (characterId: string, locationClusterId: string) => void;
  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'conversationId'>) => void;
  addConversation: (conversation: Omit<Conversation, 'id'>) => Conversation;
  addEvent: (event: Omit<WorldEvent, 'id'>) => void;
  updateCharacterKnowledge: (characterId: string, knowledge: Omit<KnowledgeEntry, 'id'>) => void;
  addLocationCluster: (cluster: Omit<LocationCluster, 'id'>) => LocationCluster;
  addCharacter: (character: Omit<Character, 'id'>) => Character;
  updateCharacter: (characterId: string, updates: Partial<Character>) => void;
  discoverCharacter: (characterId: string) => void;
  setSimulating: (simulating: boolean) => void;
  removeCharactersByCreatorMessageId: (messageId: string) => void;
  removeEventsBySourceId: (messageId: string) => void;
  deduplicateEvents: () => void;
  deduplicateConversations: () => void;

  // Selectors (read-only queries)
  getCharactersAtLocation: (clusterId: string) => Character[];
  getPlayerCharacter: () => Character | null;
  getMainConversation: () => Conversation | null;
  getOffscreenConversations: () => Conversation[];
  getCharacterById: (id: string) => Character | null;
  getLocationCluster: (id: string) => LocationCluster | null;
  getDiscoveredCharacters: () => Character[];
  getAllLocations: () => LocationCluster[];
}
```

**Persistence:** Uses Zustand's `persist` middleware with a custom storage adapter that reads/writes to the `/api/storage` REST endpoint (file-backed JSON). Only the `world` field is persisted (via `partialize`). The storage key is `surat-world-storage`, with save-slot suffixes for multiple saves.

---

### SettingsStore

Stores user preferences. Defined in `store/settings-store.ts`.

```typescript
interface SettingsStore {
  modelId: string;                    // Currently selected LLM model ID
  setModelId: (id: string) => void;   // Updates the model selection
}
```

**Persistence:** Uses Zustand's `persist` middleware with `localStorage` under the key `surat-settings`.

---

## Storage & Persistence

### STORAGE_KEYS

Centralized constants for all storage keys, defined in `lib/storage/keys.ts`.

```typescript
const STORAGE_KEYS = {
  MESSAGES: 'surat-chat-messages',       // Chat message history
  PROCESSED_TOOLS: 'surat-processed-tools', // Set of processed tool call keys
  WORLD: 'surat-world-storage',         // World state
  ACTIVE_SAVE: 'active_save_key',       // Currently active save slot identifier
} as const;
```

**Save slot system:** The `active_save_key` in `localStorage` determines which save slot is active. Storage keys are suffixed with the slot identifier (e.g., `surat-chat-messages-slot1`). The `getStorageKey()` function handles this mapping.

---

### UseChatPersistenceOptions

Input to the `useChatPersistence` hook.

```typescript
interface UseChatPersistenceOptions {
  setMessages: (messages: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) => void;
}
```

---

### UseChatPersistenceResult

Return value of the `useChatPersistence` hook.

```typescript
interface UseChatPersistenceResult {
  processedTools: React.MutableRefObject<Set<string>>; // Ref to the set of processed tool keys
  markToolProcessed: (key: string) => void;            // Add a key to the processed set and persist
  clearProcessedTool: (key: string) => void;           // Remove a key (for regeneration)
  isHydrated: boolean;                                 // Whether stored data has been loaded
  clearAll: () => Promise<void>;                       // Wipe all chat storage for this slot
  persistMessages: (messages: UIMessage[]) => void;    // Save messages to storage
}
```

**Usage:** Manages the lifecycle of chat messages and tool processing state. The `processedTools` set prevents tool calls from being executed twice when messages are replayed from storage. Uses `messageId-toolCallId` as the deduplication key.

---

### Storage API Payloads

The `/api/storage` endpoint accepts and returns JSON. Data is stored as files in the `data/` directory.

**GET** `?key=<storage-key>` — Returns the stored JSON value, or `null`.

**GET** `?list=true` — Returns an array of save metadata:
```typescript
{ id: string; updatedAt: Date }[]
```

**POST** — Stores a value:
```typescript
{ key: string; value: any }
```

**DELETE** `?key=<storage-key>` — Removes the stored file.

---

## Constants & Enumerations

### TIME_COSTS

Default tick costs for different player action types. Defined in `types/world.ts`.

```typescript
const TIME_COSTS = {
  speak: 1,    // Saying something in conversation
  move: 5,     // Moving to a different location
  examine: 2,  // Examining something closely
  action: 3,   // Performing a general action
} as const;
```

---

### ActionType

A union type derived from the keys of `TIME_COSTS`.

```typescript
type ActionType = 'speak' | 'move' | 'examine' | 'action';
```

---

### AVAILABLE_MODELS

The list of LLM models available for user selection. Defined in `lib/ai/models.ts`.

```typescript
const AVAILABLE_MODELS = [
  'deepseek/deepseek-v3.1-terminus:exacto',
  'openai/gpt-oss-120b:exacto',
  'qwen/qwen3-coder:exacto',
  'moonshotai/kimi-k2-0905:exacto',
  'z-ai/glm-4.6:exacto',
] as const;
```

---

### AvailableModel

A union type of valid model ID strings, derived from `AVAILABLE_MODELS`.

```typescript
type AvailableModel = typeof AVAILABLE_MODELS[number];
```

---

### Model Task Map

Maps internal task names to specific model IDs for the OpenRouter API. Defined in `lib/ai/openrouter.ts`.

```typescript
const models = {
  mainConversation: 'z-ai/glm-4.6:exacto',         // Primary narrative generation
  offscreenSimulation: 'z-ai/glm-4.6:exacto',       // Off-screen character dialogue
  fast: 'openai/gpt-4o-mini',                        // Logic analysis, event extraction, location resolution
  embedding: 'openai/text-embedding-3-small',        // Embedding generation (reserved, not actively used)
} as const;
```

**Note:** The `mainConversation` and `offscreenSimulation` models use a high-quality model for narrative consistency. The `fast` model is used for structured tasks (tool calling, extraction) where speed matters more than prose quality.
