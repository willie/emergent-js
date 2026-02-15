# Function Reference

Every function in EmergentJS, organized by file and architectural layer. Each entry lists the function signature, a description of what it does, and notable implementation details.

---

## Table of Contents

- [API Routes](#api-routes)
  - [app/api/chat/route.ts](#appapichartroutets)
  - [app/api/simulate/route.ts](#appapisimulateroutets)
  - [app/api/locations/resolve/route.ts](#appapilocationsresolveroutets)
  - [app/api/storage/route.ts](#appapistorageroutets)
- [Library — AI & Models](#library--ai--models)
  - [lib/ai/openrouter.ts](#libaiopenrouterts)
  - [lib/ai/models.ts](#libaimodelsts)
- [Library — Chat Processing](#library--chat-processing)
  - [lib/chat/action-analyzer.ts](#libchataction-analyzerts)
  - [lib/chat/tool-processor.ts](#libchattool-processorts)
- [Library — World Simulation](#library--world-simulation)
  - [lib/world/simulation.ts](#libworldsimulationts)
  - [lib/world/locations.ts](#libworldlocationsts)
- [Library — Storage](#library--storage)
  - [lib/storage/keys.ts](#libstoragekeysts)
- [Library — Hooks](#library--hooks)
  - [lib/hooks/use-chat-persistence.ts](#libhooksuse-chat-persistencets)
- [State Management](#state-management)
  - [store/world-store.ts](#storeworld-storets)
  - [store/settings-store.ts](#storesettings-storets)
- [Components — Chat](#components--chat)
  - [components/chat/MainChatPanel.tsx](#componentschatmainchatpaneltsx)
  - [components/chat/MessageActions.tsx](#componentschatmessageactionstsx)
- [Components — Files](#components--files)
  - [components/files/ScenarioSelector.tsx](#componentsfilesscenarioselectortsx)
  - [components/files/ScenarioImportDialog.tsx](#componentsfilesscenarioimportdialogtsx)
- [Components — Offscreen](#components--offscreen)
  - [components/offscreen/OffscreenPanelContainer.tsx](#componentsoffscreenoffscreenpanelcontainertsx)
  - [components/offscreen/OffscreenPanel.tsx](#componentsoffscreenoffscreenpaneltsx)
- [Components — Settings](#components--settings)
  - [components/settings/SettingsDialog.tsx](#componentssettingssettingsdialogtsx)
  - [components/settings/SaveLoadDialog.tsx](#componentssettingssaveloaddialogtsx)
- [Components — World](#components--world)
  - [components/world/GameLayout.tsx](#componentsworldgamelayouttsx)
  - [components/world/LocationHeader.tsx](#componentsworldlocationheadertsx)
  - [components/world/WorldClock.tsx](#componentsworldworldclocktsx)
  - [components/world/CharacterPanel.tsx](#componentsworldcharacterpaneltsx)
  - [components/world/WorldProvider.tsx](#componentsworldworldprovidertsx)
- [Pages](#pages)
  - [app/page.tsx](#apppagetsx)
  - [app/layout.tsx](#applayouttsx)

---

## API Routes

Server-side request handlers for the Next.js App Router.

---

### `app/api/chat/route.ts`

The main narrative generation endpoint. Implements a 3-stage pipeline: Logic Analysis, Action Execution, and Narration.

#### `POST(req: Request): Promise<Response>`
- **Line:** 17
- **Description:** Handles chat requests. Parses `{ messages, worldState, modelId }` from the request body. Executes the 3-stage pipeline:
  1. **Stage 1 — Logic Analysis:** If the last message is from the user (not a tool result), calls `analyzePlayerIntent()` to detect game actions (movement, time advance, character discovery).
  2. **Stage 2 — Action Execution:** If tool calls were detected, uses the OpenAI client directly to emit tool calls via a streaming SSE response. Returns immediately — the narrator is not invoked.
  3. **Stage 3 — Narration:** If no tool calls were detected (or the request is a tool result follow-up), streams a narrative response using `streamText()` from the Vercel AI SDK with zero tools.
- **Returns:** An SSE stream — either raw OpenAI chunks (Stage 2) or a `UIMessageStreamResponse` (Stage 3).

#### `buildSystemPrompt(world: WorldState): string`
- **Line:** 156
- **Description:** Constructs the narrator's system prompt from the current world state. Includes: scenario description, current location, other known locations, narrative time, present characters with their last 3 knowledge entries, undiscovered characters as hints, and recent events (last 5). Defines the narrator's role and behavioral guidelines.
- **Returns:** A complete system prompt string.

---

### `app/api/simulate/route.ts`

Off-screen character simulation endpoint.

#### `POST(req: Request): Promise<Response>`
- **Line:** 4
- **Description:** Parses `{ worldState, playerLocationClusterId, timeSinceLastSimulation, modelId }` from the request body. Extracts the 15 most recent events (sorted chronologically) as context, then delegates to `simulateOffscreen()`.
- **Returns:** JSON containing `{ events, conversations, characterUpdates }`.

---

### `app/api/locations/resolve/route.ts`

Location resolution endpoint.

#### `POST(req: Request): Promise<Response>`
- **Line:** 4
- **Description:** Parses `{ description, existingClusters, modelId }` from the request body. Delegates to `resolveLocation()` to semantically match the description against existing location clusters.
- **Returns:** JSON containing `{ clusterId, canonicalName, isNew }`.

---

### `app/api/storage/route.ts`

File-backed JSON key-value storage endpoint.

#### `GET(req: Request): Promise<Response>`
- **Line:** 15
- **Description:** Two modes:
  - `?list=true` — Lists all `.json` files in the `data/` directory. Returns `{ id, updatedAt }[]`.
  - `?key=<name>` — Reads and returns the JSON contents of `data/<sanitized-key>.json`. Returns `null` if the file doesn't exist.

#### `POST(req: Request): Promise<Response>`
- **Line:** 58
- **Description:** Writes a JSON value to disk. Parses `{ key, value }` from the request body. Sanitizes the key (strips non-alphanumeric characters except `-` and `_`) and writes to `data/<key>.json`.

#### `DELETE(req: Request): Promise<Response>`
- **Line:** 79
- **Description:** Deletes the file at `data/<sanitized-key>.json`. Returns success or error.

#### `ensureDataDir(): Promise<void>`
- **Line:** 7
- **Description:** Creates the `data/` directory if it doesn't exist. Called before every read/write/list operation.

---

## Library — AI & Models

LLM client configuration and model definitions.

---

### `lib/ai/openrouter.ts`

OpenRouter AI SDK provider setup and model configuration.

#### `openrouter`
- **Line:** 3
- **Description:** The OpenRouter provider instance created via `createOpenRouter()`. Configured with `OPENROUTER_API_KEY` from environment variables. Used as the model provider for all Vercel AI SDK calls.

#### `models`
- **Line:** 8
- **Description:** A constant object mapping task names to model IDs:
  - `mainConversation`: `'z-ai/glm-4.6:exacto'` — Primary narrative generation.
  - `offscreenSimulation`: `'z-ai/glm-4.6:exacto'` — Off-screen dialogue.
  - `fast`: `'openai/gpt-4o-mini'` — Logic analysis, extraction, location resolution.
  - `embedding`: `'openai/text-embedding-3-small'` — Reserved for future use.

#### `getModel(task: keyof typeof models): ReturnType<typeof openrouter>`
- **Line:** 19
- **Description:** Returns the OpenRouter model instance for a given task name.

---

### `lib/ai/models.ts`

User-selectable model list.

#### `AVAILABLE_MODELS`
- **Line:** 2
- **Description:** A readonly tuple of model ID strings available for user selection in the settings dialog.

#### `DEFAULT_MODEL`
- **Line:** 12
- **Description:** The first entry in `AVAILABLE_MODELS`, used as the initial value for `SettingsStore.modelId`.

---

## Library — Chat Processing

Logic analysis and tool execution for the chat pipeline.

---

### `lib/chat/action-analyzer.ts`

Stage 1 of the chat pipeline. Analyzes player input to determine game actions.

#### `analyzePlayerIntent(messages: any[], worldState: WorldState, modelId?: string): Promise<AnalyzerResult>`
- **Line:** 73
- **Description:** Sends the conversation history (converted to OpenAI format) along with a system prompt describing the current world state to a fast LLM. The LLM is given the three game tools (`moveToLocation`, `advanceTime`, `discoverCharacter`) with `tool_choice: 'auto'`. Parses any tool calls from the response into `SimpleToolCall[]`.
- **Returns:** `{ toolCalls, context }` where `context` is always an empty string.
- **Side effects:** Logs detected tool calls to the console.

#### `openai`
- **Line:** 6
- **Description:** An `OpenAI` client instance configured to use the OpenRouter API base URL. Used for direct API calls that bypass the Vercel AI SDK (to avoid Zod 4 compatibility issues with tool schemas).

#### `GAME_TOOLS_CUSTOM_SCHEMA`
- **Line:** 12
- **Description:** An array of three `ChatCompletionTool` objects defining the game tools as raw JSON Schema. Avoids Zod schema generation to prevent SDK incompatibility.

---

### `lib/chat/tool-processor.ts`

Processes tool call results and applies world state mutations.

#### `processToolResult(result: ToolResult, messageId: string, toolCallId: string, options: ProcessToolResultOptions): Promise<void>`
- **Line:** 160
- **Description:** The main tool processing function. Handles three result types:
  - **`movement`:** Resolves the destination via the location API (with a manual fallback using `extractCanonicalName`). Creates a new `LocationCluster` if needed. Moves the player and any accompanied characters. Triggers off-screen simulation if enough time has passed and the player changed locations. Advances time.
  - **`time_advance`:** Advances the world clock by the specified ticks and updates narrative time.
  - **`character_discovery`:** Finds the character by fuzzy name matching. If found, marks them as discovered. If not found, creates a new `Character` at the player's location, tagged with `createdByMessageId` for cleanup on regeneration.
- **Deduplication:** Uses `processedTools` set with key `${messageId}-${toolCallId}` to prevent double-processing.

#### `resolveLocationViaApi(description: string, existingClusters: LocationCluster[], modelId: string): Promise<ResolveLocationResult | null>`
- **Line:** 85
- **Description:** Client-side wrapper that calls `POST /api/locations/resolve`. Returns the resolution result or `null` on failure.

#### `runSimulationViaApi(worldState: WorldState, playerLocationClusterId: string, timeSinceLastSimulation: number, modelId: string): Promise<SimulationResult | null>`
- **Line:** 110
- **Description:** Client-side wrapper that calls `POST /api/simulate`. Returns the simulation result or `null` on failure.

#### `normalizeName(name: string): string`
- **Line:** 44
- **Description:** Normalizes a character name for fuzzy matching by lowercasing and removing non-word characters.

#### `findBestCharacterMatch(searchName: string, characters: Character[]): { id: string; name: string } | null`
- **Line:** 54
- **Description:** Finds the best matching character using progressive strategies:
  1. Exact case-insensitive match.
  2. Normalized exact match.
  3. Substring match (either name contains search or search contains name).
- **Returns:** The matched character's `{ id, name }` or `null`.

---

## Library — World Simulation

Off-screen character interaction simulation.

---

### `lib/world/simulation.ts`

The simulation engine that generates off-screen character dialogues and events.

#### `simulateOffscreen(world: WorldState, playerLocationClusterId: string, timeSinceLastSimulation: number, modelId?: string, relevantEvents?: WorldEvent[]): Promise<{ events, conversations, characterUpdates }>`
- **Line:** 233
- **Description:** The primary entry point for off-screen simulation. Filters for discovered NPCs not at the player's location, groups them by location, and for each group with 2+ characters, determines simulation depth and runs the appropriate simulation (full dialogue or summary). Aggregates results across all location groups.
- **Returns:** `{ events: WorldEvent[], conversations: Omit<Conversation, 'id'>[], characterUpdates: { characterId, newLocationId }[] }`.

#### `runFullSimulation(characters: Character[], locationName: string, timeElapsed: number, world: WorldState, modelId?: string, relevantEvents?: WorldEvent[]): Promise<{ events, messages, conversation, movements }>`
- **Line:** 73
- **Description:** Generates a full dialogue between characters at a location. Constructs a detailed prompt including character descriptions, goals, relationships, shared history, and available locations. The turn count scales with elapsed time (up to 8 exchanges). After generating dialogue, a second LLM call uses the `reportSimulation` tool to extract structured events and movements. Resolves character and location names to IDs.
- **Returns:** `{ events: WorldEvent[], messages: Message[], conversation: Omit<Conversation, 'id'>, movements: { characterId, newLocationId }[] }`.

#### `generateSummary(characters: Character[], locationName: string, timeElapsed: number, world: WorldState, modelId?: string): Promise<WorldEvent>`
- **Line:** 38
- **Description:** Generates a brief 1–2 sentence summary of what characters did during the elapsed time. Used for `'summary'` depth simulation.
- **Returns:** A `WorldEvent` marked as `isOffscreen: true`.

#### `determineSimulationDepth(timeSinceLastInteraction: number, hasUnresolvedPlotPoints: boolean): SimulationDepth`
- **Line:** 12
- **Description:** Determines how deeply to simulate based on elapsed time:
  - `< 5` ticks → `'skip'`
  - `> 20` ticks or unresolved plot → `'full'`
  - `> 10` ticks → `'summary'`
  - Otherwise → `'skip'`

#### `groupCharactersByLocation(characters: Character[]): Map<string, Character[]>`
- **Line:** 25
- **Description:** Groups an array of characters into a `Map` keyed by `currentLocationClusterId`. Used to identify which characters can interact at each location.

---

### `lib/world/locations.ts`

Location resolution and semantic matching.

#### `resolveLocation(description: string, existingClusters: LocationCluster[], modelId?: string): Promise<{ clusterId, canonicalName, isNew }>`
- **Line:** 10
- **Description:** Resolves a location description to an existing cluster or determines it's new. If no clusters exist, extracts a canonical name directly. Otherwise, sends the description and cluster list to an LLM with a `resolveLocation` tool (Zod-validated schema). If the LLM's match confidence is >= 0.6, returns the matched cluster. Otherwise, returns `isNew: true` with an extracted canonical name.

#### `extractCanonicalName(description: string): string`
- **Line:** 93
- **Description:** Extracts a short canonical location name from a free-text description. Strips leading articles ("the", "a", "to", etc.) and trailing generic words ("area", "place", "room", etc.). Title-cases the first 4 words.
- **Example:** `"the old coffee shop building"` → `"Old Coffee Shop"`.

---

## Library — Storage

Storage key management and save slot system.

---

### `lib/storage/keys.ts`

Centralized storage key constants and slot management.

#### `STORAGE_KEYS`
- **Line:** 6
- **Description:** Constant object containing all storage key base strings: `MESSAGES`, `PROCESSED_TOOLS`, `WORLD`, `ACTIVE_SAVE`.

#### `getStorageKey(base: string): string`
- **Line:** 17
- **Description:** Returns a storage key with the active save slot suffix appended. Reads `active_save_key` from `localStorage`, extracts the slot identifier, and appends it to the base key. Returns the base key unchanged if no active slot or using the default slot.
- **Example:** With `active_save_key = 'surat-world-storage-slot1'`, calling `getStorageKey('surat-chat-messages')` returns `'surat-chat-messages-slot1'`.

#### `getActiveSaveSlot(): string | null`
- **Line:** 32
- **Description:** Returns the currently active save slot key from `localStorage`, or `null` if using the default slot.

#### `setActiveSaveSlot(slot: string): void`
- **Line:** 42
- **Description:** Sets the active save slot in `localStorage`.

#### `clearActiveSaveSlot(): void`
- **Line:** 50
- **Description:** Resets to the default save slot by setting `active_save_key` to the default world storage key.

---

## Library — Hooks

React hooks for persistent state management.

---

### `lib/hooks/use-chat-persistence.ts`

Hook and utilities for chat message and tool processing persistence.

#### `useChatPersistence({ setMessages }): UseChatPersistenceResult`
- **Line:** 123
- **Description:** React hook that manages the persistence lifecycle for chat messages and processed tool state. On mount, loads stored messages and processed tools from the storage API. Returns refs and callbacks for marking tools as processed, clearing tools, and persisting messages.
- **Returns:** `{ processedTools, markToolProcessed, clearProcessedTool, isHydrated, clearAll, persistMessages }`.

#### `clearChatStorage(): Promise<void>`
- **Line:** 86
- **Description:** Clears all chat-related storage for the current save slot by writing empty arrays to both the messages and processed tools storage keys.

#### `loadStoredMessages(): Promise<UIMessage[]>`
- **Line:** 7
- **Description:** Loads chat messages from the storage API for the current save slot. Falls back to `localStorage` for migration from the legacy storage format. Returns an empty array on failure.

#### `saveMessages(messages: UIMessage[]): Promise<void>`
- **Line:** 29
- **Description:** Persists the current chat messages to the storage API under the current slot's message key.

#### `loadProcessedTools(): Promise<Set<string>>`
- **Line:** 45
- **Description:** Loads the set of processed tool keys from the storage API. Falls back to `localStorage` for legacy migration. Returns an empty `Set` on failure.

#### `saveProcessedTools(tools: Set<string>): Promise<void>`
- **Line:** 67
- **Description:** Persists the processed tools set (converted to an array) to the storage API.

---

## State Management

Zustand stores for client-side state.

---

### `store/world-store.ts`

The primary game state store.

#### `generateId(): string`
- **Line:** 14
- **Description:** Returns a new UUID via `crypto.randomUUID()`. Used for all entity IDs.

#### `useWorldStore` — Actions

All actions are methods on the Zustand store. They mutate `state.world` immutably via `set()`.

| Method | Line | Description |
|--------|------|-------------|
| `initializeScenario(config)` | 59 | Creates a new `WorldState` from a `ScenarioConfig`. Validates the config, generates UUIDs for all entities, creates `LocationCluster` objects from initial locations, resolves character starting positions, creates the player character, creates the main conversation, and sets the initial world state. Characters at the player's starting location are auto-discovered. |
| `resetWorld()` | 145 | Sets `world` to `null` and `isSimulating` to `false`. Triggers the landing page. |
| `advanceTime(ticks, narrativeTime?)` | 149 | Adds `ticks` to `world.time.tick`. Optionally updates `narrativeTime`. Supports negative ticks for regeneration rollback. |
| `moveCharacter(characterId, locationClusterId)` | 164 | Updates a character's `currentLocationClusterId`. |
| `addMessage(conversationId, message)` | 180 | Appends a new `Message` (with generated ID) to the specified conversation. |
| `addConversation(conversation)` | 201 | Adds a new `Conversation` (with generated ID) to the world. Returns the created conversation. |
| `addEvent(event)` | 218 | Appends a new `WorldEvent` (with generated ID) to `world.events`. |
| `removeEventsBySourceId(messageId)` | 234 | Removes all events whose `sourceMessageId` matches the given ID. Used during regeneration cleanup. |
| `deduplicateEvents()` | 248 | Removes duplicate events by `timestamp + description` key. Sorts chronologically first to preserve order. |
| `deduplicateConversations()` | 279 | Removes duplicate off-screen conversations by `locationClusterId + sorted participantIds + first message timestamp` signature. Always preserves the main conversation. |
| `updateCharacterKnowledge(characterId, knowledge)` | 323 | Appends a new `KnowledgeEntry` (with generated ID) to a character's knowledge array. |
| `addLocationCluster(cluster)` | 343 | Adds a new `LocationCluster` (with generated ID) to the world. Returns the created cluster. |
| `addCharacter(character)` | 360 | Adds a new `Character` (with generated ID) to the world. Returns the created character. |
| `updateCharacter(characterId, updates)` | 377 | Merges partial updates into a character's fields. |
| `discoverCharacter(characterId)` | 391 | Sets `isDiscovered: true` on the specified character. |
| `setSimulating(simulating)` | 405 | Sets the `isSimulating` flag (controls UI loading state). |
| `removeCharactersByCreatorMessageId(messageId)` | 409 | Removes all characters whose `createdByMessageId` matches. Used during regeneration to prevent duplicate dynamic characters. |

#### `useWorldStore` — Selectors

Read-only query methods that derive data from the current world state.

| Method | Line | Description |
|--------|------|-------------|
| `getCharactersAtLocation(clusterId)` | 424 | Returns discovered characters at a location. |
| `getPlayerCharacter()` | 432 | Returns the player `Character` or `null`. |
| `getMainConversation()` | 438 | Returns the main `Conversation` or `null`. |
| `getOffscreenConversations()` | 444 | Returns all active off-screen conversations. |
| `getCharacterById(id)` | 452 | Returns a character by ID or `null`. |
| `getLocationCluster(id)` | 458 | Returns a location cluster by ID or `null`. |
| `getDiscoveredCharacters()` | 464 | Returns all discovered non-player characters. |
| `getAllLocations()` | 470 | Returns all location clusters. |

#### Persistence Configuration
- **Line:** 476
- **Storage key:** `'surat-world-storage'`
- **Custom storage adapter:** Reads/writes via the `/api/storage` REST endpoint. On read, falls back to `localStorage` for migration. On write, skips if `world` is `null` (prevents saving cleared state).
- **Partialize:** Only the `world` field is persisted.

---

### `store/settings-store.ts`

User preferences store.

#### `useSettingsStore`
- **Line:** 10
- **Description:** Zustand store with a single `modelId` field and a `setModelId` action. Persisted to `localStorage` under key `'surat-settings'`.

---

## Components — Chat

The main chat interface and message action controls.

---

### `components/chat/MainChatPanel.tsx`

The primary chat component connecting the AI chat interface to the world state.

#### `MainChatPanel(): JSX.Element`
- **Line:** 78
- **Description:** The main chat panel React component. Wires together:
  - `useChat()` from the Vercel AI SDK for streaming chat.
  - `useChatPersistence()` for message/tool persistence.
  - `useWorldStore` selectors and actions for world state mutations.
  - Tool result processing via `processToolResult()`.
  - Message rendering with Markdown support.
  - Input form with Send and Continue buttons.

#### `handleProcessToolResult(result, messageId, toolCallId): Promise<void>`
- **Line:** 142
- **Description:** Creates a `WorldActions` adapter from Zustand store actions and delegates to `processToolResult()`. This bridges the React component layer to the tool processing library.

#### `handleSubmit(e: React.FormEvent): void`
- **Line:** 433
- **Description:** Form submit handler. Advances time by 1 tick, sends the user's input via `sendMessage()`, and clears the input field. Disabled during loading/simulation.

#### `handleContinue(): void`
- **Line:** 442
- **Description:** Sends a `"__SURAT_CONTINUE__"` message to trigger another narrative response without user input. The continue message is cleaned up from history in the `onFinish` callback.

#### `handleRegenerate(): void`
- **Line:** 318
- **Description:** Regenerates the last assistant response. Clears processed tool results for the message, removes dynamically-created characters and events tied to the message, reverts time cost (using negative ticks), and calls `regenerate()`.

#### `handleEditMessage(messageId, content): void`
- **Line:** 448
- **Description:** Enters edit mode for a message by setting `editingNodeId` and `editContent` state.

#### `handleDeleteMessage(messageIndex): void`
- **Line:** 453
- **Description:** Removes a message at the given index from the messages array.

#### `handleRewindMessage(messageIndex): void`
- **Line:** 458
- **Description:** Truncates the message history to everything before the given index.

#### `handleSaveEdit(messageId): void`
- **Line:** 467
- **Description:** Saves an edited message by replacing the text part content at the specified message ID.

#### `handleProcessedToolsClear(): void`
- **Line:** 463
- **Description:** No-op callback. Persistence is handled automatically via `markToolProcessed`.

#### Type Guards

| Function | Line | Description |
|----------|------|-------------|
| `isTextPart(part)` | 51 | Returns `true` if the part has `type: 'text'` and a `text` property. |
| `isToolResultPart(part)` | 60 | Returns `true` if the part has `type: 'tool-result'`. |
| `isDynamicToolPart(part)` | 68 | Returns `true` if the part's type string starts with `'tool-'`. |
| `isToolResult(value)` | 74 | Returns `true` if the value is an object with a `type` property (loose check for `ToolResult` union). |

#### History Repair (useEffect)
- **Line:** 180
- **Description:** Runs once per session after hydration. Performs three healing operations:
  1. **Heal processed tools:** If the world has advanced but the processed tools set is empty (lost persistence), scans all assistant messages and marks their tool invocations as processed.
  2. **Deduplicate events:** Calls `deduplicateEvents()` to clean up duplicate world events.
  3. **Deduplicate conversations:** Calls `deduplicateConversations()` to clean up duplicate off-screen conversations.

---

### `components/chat/MessageActions.tsx`

Action buttons (edit, delete, rewind) for individual chat messages.

#### `MessageActions(props): JSX.Element`
- **Line:** 50
- **Description:** Renders three icon buttons for each message: Edit, Delete, and Rewind. Handles clearing processed tool results when messages are deleted or rewound.

#### `handleEdit(): void`
- **Line:** 60
- **Description:** Finds the text part of the message and calls `onEdit` with the message ID and text content.

#### `handleDelete(): void`
- **Line:** 67
- **Description:** Clears processed tool keys for this message from the `processedToolResults` ref, then calls `onDelete`.

#### `handleRewind(): void`
- **Line:** 77
- **Description:** Clears processed tool keys for this message and all subsequent messages, then calls `onRewind`.

#### `getToolKeysForMessage(message): string[]`
- **Line:** 40
- **Description:** Extracts all tool-related part keys from a message (parts whose type starts with `'tool-'`). Returns `["<messageId>-<partType>", ...]`.

#### Icon Components

| Function | Line | Description |
|----------|------|-------------|
| `EditIcon()` | 16 | Renders a pencil SVG icon (14x14). |
| `DeleteIcon()` | 24 | Renders a trash can SVG icon (14x14). |
| `RewindIcon()` | 32 | Renders a circular rewind arrow SVG icon (14x14). |

---

## Components — Files

Scenario selection and import UI.

---

### `components/files/ScenarioSelector.tsx`

The main menu / landing page for starting or loading games.

#### `ScenarioSelector(): JSX.Element`
- **Line:** 9
- **Description:** Full-screen component with two tabs: "New Game" and "Load Game". Displays built-in and custom scenarios for new games, and a list of saved games for loading. Supports importing, exporting, and deleting custom scenarios.

#### `loadCustomScenarios(): Promise<void>`
- **Line:** 25
- **Description:** Fetches custom scenarios from `storage?key=custom_scenarios`. Populates the `customScenarios` state array.

#### `saveCustomScenarios(scenarios): Promise<void>`
- **Line:** 37
- **Description:** Persists the custom scenarios array to the storage API under the `custom_scenarios` key.

#### `loadSavedGames(): Promise<void>`
- **Line:** 56
- **Description:** Fetches the list of all save files, filters for world storage files, and sorts by last modified date (newest first).

#### `handleStartScenario(scenario): void`
- **Line:** 73
- **Description:** Creates a new save slot with a timestamp-based ID, sets it as the active save in `localStorage`, and calls `initializeScenario()`.

#### `handleImportScenario(scenario): void`
- **Line:** 96
- **Description:** Appends the imported scenario to the custom scenarios list and persists.

#### `handleDeleteScenario(indexToDelete): void`
- **Line:** 105
- **Description:** Removes a custom scenario by index (with confirmation) and persists.

#### `handleExportScenario(scenario): void`
- **Line:** 112
- **Description:** Downloads the scenario as a JSON file. Creates a temporary `<a>` element with a data URI and triggers a click.

#### `handleLoadGame(id): void`
- **Line:** 122
- **Description:** Sets the selected save ID as the active key in `localStorage` and reloads the page (with confirmation).

#### `getDisplayName(id): string`
- **Line:** 131
- **Description:** Converts a save ID to a human-readable name. `'surat-world-storage'` → `'Default'`; otherwise strips the prefix and replaces hyphens with spaces.

---

### `components/files/ScenarioImportDialog.tsx`

Modal dialog for importing scenario JSON files.

#### `ScenarioImportDialog({ isOpen, onClose, onImport }): JSX.Element | null`
- **Line:** 12
- **Description:** Renders a modal with a file upload area. Reads the selected `.json` file, validates it against `ScenarioSchema` using Zod's `safeParse`, and calls `onImport` on success. Displays validation errors on failure.

#### `handleFileChange(e): void`
- **Line:** 18
- **Description:** FileReader-based handler that parses the uploaded file as JSON, validates with Zod, and either imports or displays an error.

---

## Components — Offscreen

Off-screen simulation display.

---

### `components/offscreen/OffscreenPanelContainer.tsx`

Container that lists all off-screen conversations.

#### `OffscreenPanelContainer(): JSX.Element`
- **Line:** 6
- **Description:** Fetches off-screen conversations from the store, sorts them by most recent message timestamp (newest first), and renders an `OffscreenPanel` for each. Shows an empty state message when no off-screen activity exists.

---

### `components/offscreen/OffscreenPanel.tsx`

Expandable panel displaying a single off-screen conversation.

#### `OffscreenPanel({ conversationId }): JSX.Element | null`
- **Line:** 10
- **Description:** Renders a collapsible panel for one off-screen conversation. Shows participant names and location in the header, with a time range indicator. The body displays dialogue messages attributed to specific characters via `speakerId`.

---

## Components — Settings

Settings and save management dialogs.

---

### `components/settings/SettingsDialog.tsx`

Model selection dialog.

#### `SettingsDialog({ isOpen, onClose }): JSX.Element | null`
- **Line:** 11
- **Description:** Modal dialog displaying radio buttons for each model in `AVAILABLE_MODELS`. Reads and writes `modelId` via `useSettingsStore`.

---

### `components/settings/SaveLoadDialog.tsx`

Save game management dialog.

#### `SaveLoadDialog({ isOpen, onClose }): JSX.Element | null`
- **Line:** 16
- **Description:** Modal dialog for managing save games. Lists all world storage saves with the active one highlighted. Supports creating new saves, loading existing saves (via page reload), and deleting saves (including associated chat and tool data).

#### `loadSaves(): Promise<void>`
- **Line:** 35
- **Description:** Fetches save files from the storage API, filters for world storage files, and sorts by date.

#### `handleCreateSave(): void`
- **Line:** 54
- **Description:** Creates a new save slot from the user-entered name. Slugifies the name, checks for duplicates, sets the active key, and reloads the page.

#### `handleLoad(id): void`
- **Line:** 78
- **Description:** Switches to the selected save slot by setting the active key and reloading (with confirmation).

#### `handleDelete(id, e): Promise<void>`
- **Line:** 86
- **Description:** Deletes a save and its associated chat/tool storage files (with confirmation). If the deleted save was active, switches to the default slot and reloads.

#### `getDisplayName(id): string`
- **Line:** 110
- **Description:** Converts a save ID to a display name (same logic as in `ScenarioSelector`).

---

## Components — World

Core game UI components.

---

### `components/world/GameLayout.tsx`

The main game layout orchestrating all panels.

#### `GameLayout(): JSX.Element`
- **Line:** 17
- **Description:** Top-level layout component. If no world is loaded (`world === null`), renders the `ScenarioSelector`. Otherwise, renders: the header with `LocationHeader` and `WorldClock`, the main `MainChatPanel`, a sidebar with tabs for `OffscreenPanelContainer` and `CharacterPanel`, mobile bottom navigation, and dialog overlays for settings and saves.

#### `handleMobileNav(view): void`
- **Line:** 33
- **Description:** Switches between mobile views: `'chat'` shows the chat panel; `'locations'` shows the sidebar with the Elsewhere tab; `'people'` shows the sidebar with the Characters tab.

---

### `components/world/LocationHeader.tsx`

Displays the player's current location and present characters.

#### `LocationHeader({ topRight, bottomRight }): JSX.Element | null`
- **Line:** 5
- **Description:** Header component that queries the world store for the player character, their current location cluster, and nearby discovered NPCs. Renders the location name and a list of present character names. Accepts `topRight` and `bottomRight` React node slots for additional content (used for `WorldClock` and settings buttons).

---

### `components/world/WorldClock.tsx`

Displays the current narrative time and tick counter.

#### `WorldClock(): JSX.Element | null`
- **Line:** 5
- **Description:** Simple display component showing `world.time.narrativeTime` and `world.time.tick` from the store.

---

### `components/world/CharacterPanel.tsx`

Displays discovered characters with expandable details and inline editing.

#### `CharacterPanel(): JSX.Element`
- **Line:** 6
- **Description:** Lists all discovered non-player characters with their current location. Each entry is expandable to show the character's description and last 5 knowledge entries. Supports inline editing of character name and description via `updateCharacter`.

#### `startEditing(char, e): void`
- **Line:** 15
- **Description:** Enters edit mode for a character — sets the editing ID and populates the edit form.

#### `saveEdit(charId, e): void`
- **Line:** 22
- **Description:** Saves the edit form values to the character via `updateCharacter` and exits edit mode.

#### `cancelEdit(e): void`
- **Line:** 28
- **Description:** Exits edit mode without saving.

---

### `components/world/WorldProvider.tsx`

Hydration gate for the Zustand persisted store.

#### `WorldProvider({ children }): JSX.Element`
- **Line:** 23
- **Description:** Wraps children in a hydration check. Uses `useSyncExternalStore` to subscribe to the Zustand persist middleware's hydration state. Shows "Loading..." until the store has finished hydrating from the storage API. Does not block on `world === null` — that's handled by `GameLayout`.

#### `subscribeToHydration(callback): () => void`
- **Line:** 10
- **Description:** Subscription function for `useSyncExternalStore`. Listens to the Zustand persist middleware's `onFinishHydration` event.

#### `getHydrated(): boolean`
- **Line:** 15
- **Description:** Snapshot function for `useSyncExternalStore`. Returns whether the store has finished hydrating.

#### `getServerHydrated(): boolean`
- **Line:** 19
- **Description:** Server snapshot function. Always returns `false` (SSR always shows loading state).

---

## Pages

Next.js App Router page components.

---

### `app/page.tsx`

#### `Home(): JSX.Element`
- **Line:** 4
- **Description:** The root page component. Wraps `GameLayout` in `WorldProvider` to ensure store hydration before rendering.

---

### `app/layout.tsx`

#### `RootLayout({ children }): JSX.Element`
- **Line:** 26
- **Description:** The root HTML layout. Configures Geist Sans and Geist Mono fonts, sets `lang="en"`, and applies `suppressHydrationWarning`. Exports metadata (title, description) and viewport configuration.
