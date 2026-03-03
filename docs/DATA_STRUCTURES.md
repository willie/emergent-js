# Data Structures Reference

This document describes every data structure used in EmergentJS, an AI-powered interactive narrative engine. Data structures are organized by domain: world model, scenario configuration, AI/chat pipeline, simulation engine, state management, and storage.

---

## Table of Contents

- [World Model](#world-model)
  - [WorldState](#worldstate)
  - [Character](#character)
  - [LocationCluster](#locationcluster)
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
  - [ScenarioSchema (Zod Validation)](#scenarioschema-zod-validation)
- [AI & Chat Pipeline](#ai--chat-pipeline)
  - [AnalyzerResult](#analyzerresult)
  - [SimpleToolCall](#simpletoolcall)
  - [Game Tools (OpenAI Function Schema)](#game-tools-openai-function-schema)
  - [Chat API Request Body](#chat-api-request-body)
- [Tool Processing](#tool-processing)
  - [ResolveLocationResult](#resolvelocationresult)
  - [SimulationResult](#simulationresult)
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
  events: WorldEvent[];              // History of significant events
  conversations: Conversation[];     // All conversations (main + offscreen)
  playerCharacterId: string;         // ID of the player's character
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

### ScenarioSchema (Zod Validation)

Runtime validation schema for scenario data, defined in `types/scenario.ts`. Mirrors the TypeScript interfaces above but enforces constraints at runtime.

```typescript
const ScenarioSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  initialNarrativeTime: z.string().min(1),
  locations: z.array(z.object({
    name: z.string().min(1),
    description: z.string().min(1),
  })).min(1),
  characters: z.array(z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    isPlayer: z.boolean(),
    initialLocationName: z.string().min(1),
    encounterChance: z.number().min(0).max(1),
    goals: z.string().optional(),
  })).min(1),
  playerStartingLocation: z.string().min(1),
});
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

These structures handle the execution of game actions and their side effects. Tool calls are processed server-side in `app/api/chat/route.ts`, which builds a `StateDelta` (see [Chat Types](lib/chat/types.ts)) that the client applies.

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
  deduplicateLocationClusters: () => void;

  // Selectors (read-only queries)
  getOffscreenConversations: () => Conversation[];
  getCharacterById: (id: string) => Character | null;
  getLocationCluster: (id: string) => LocationCluster | null;
}
```

**Persistence:** Uses Zustand's `persist` middleware with a custom storage adapter that reads/writes to the `/api/storage` REST endpoint (file-backed JSON). Only the `world` field is persisted (via `partialize`). The storage key is `STORAGE_KEYS.WORLD` (`'surat-world-storage'`), with save-slot suffixes for multiple saves.

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
  isHydrated: boolean;                                 // Whether stored data has been loaded
  persistMessages: (messages: UIMessage[]) => void;    // Save messages to storage (debounced, 2s)
}
```

**Usage:** Manages the lifecycle of chat message persistence. Messages are saved with a 2-second debounce to prevent network request storms during streaming. The `clearChatStorage()` export is available separately for wiping chat data.

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
  mainConversation: 'z-ai/glm-4.6:exacto',  // Primary narrative generation + off-screen simulation
  fast: 'openai/gpt-4o-mini',                // Logic analysis, event extraction, location resolution
} as const;
```

**Note:** The `mainConversation` model is used for narrative generation and off-screen simulation dialogue. The `fast` model is used for structured tasks (tool calling, extraction) where speed matters more than prose quality.
