# store/world-store.ts

The primary game state store. Built with Zustand and persisted via a custom storage adapter that uses the `/api/storage` REST endpoint.

**Layer:** State Management

---

## Utility Functions

### `generateId(): string`
- **Line:** 14
- **Description:** Returns a new UUID via `crypto.randomUUID()`. Used for all entity IDs.

---

## Actions

All actions are methods on the Zustand store. They mutate `state.world` immutably via `set()`.

### `initializeScenario(config: ScenarioConfig): void`
- **Line:** 59
- **Description:** Creates a new `WorldState` from a `ScenarioConfig`. Validates the config, generates UUIDs for all entities, creates `LocationCluster` objects from initial locations, resolves character starting positions, creates the player character, creates the main conversation, and sets the initial world state. Characters at the player's starting location are auto-discovered.

---

### `resetWorld(): void`
- **Line:** 145
- **Description:** Sets `world` to `null` and `isSimulating` to `false`. Triggers the landing page.

---

### `advanceTime(ticks: number, narrativeTime?: string): void`
- **Line:** 149
- **Description:** Adds `ticks` to `world.time.tick`. Optionally updates `narrativeTime`. Supports negative ticks for regeneration rollback.

---

### `moveCharacter(characterId: string, locationClusterId: string): void`
- **Line:** 164
- **Description:** Updates a character's `currentLocationClusterId`.

---

### `addMessage(conversationId: string, message: Omit<Message, 'id'>): void`
- **Line:** 180
- **Description:** Appends a new `Message` (with generated ID) to the specified conversation.

---

### `addConversation(conversation: Omit<Conversation, 'id'>): Conversation`
- **Line:** 201
- **Description:** Adds a new `Conversation` (with generated ID) to the world. Returns the created conversation.

---

### `addEvent(event: Omit<WorldEvent, 'id'>): void`
- **Line:** 218
- **Description:** Appends a new `WorldEvent` (with generated ID) to `world.events`.

---

### `removeEventsBySourceId(messageId: string): void`
- **Line:** 234
- **Description:** Removes all events whose `sourceMessageId` matches the given ID. Used during regeneration cleanup.

---

### `deduplicateEvents(): void`
- **Line:** 248
- **Description:** Removes duplicate events by `timestamp + description` key. Sorts chronologically first to preserve order.

---

### `deduplicateConversations(): void`
- **Line:** 279
- **Description:** Removes duplicate off-screen conversations by `locationClusterId + sorted participantIds + first message timestamp` signature. Always preserves the main conversation.

---

### `updateCharacterKnowledge(characterId: string, knowledge: Omit<KnowledgeEntry, 'id'>): void`
- **Line:** 323
- **Description:** Appends a new `KnowledgeEntry` (with generated ID) to a character's knowledge array.

---

### `addLocationCluster(cluster: Omit<LocationCluster, 'id'>): LocationCluster`
- **Line:** 343
- **Description:** Adds a new `LocationCluster` (with generated ID) to the world. Returns the created cluster.

---

### `addCharacter(character: Omit<Character, 'id'>): Character`
- **Line:** 360
- **Description:** Adds a new `Character` (with generated ID) to the world. Returns the created character.

---

### `updateCharacter(characterId: string, updates: Partial<Character>): void`
- **Line:** 377
- **Description:** Merges partial updates into a character's fields.

---

### `discoverCharacter(characterId: string): void`
- **Line:** 391
- **Description:** Sets `isDiscovered: true` on the specified character.

---

### `setSimulating(simulating: boolean): void`
- **Line:** 405
- **Description:** Sets the `isSimulating` flag (controls UI loading state).

---

### `removeCharactersByCreatorMessageId(messageId: string): void`
- **Line:** 409
- **Description:** Removes all characters whose `createdByMessageId` matches. Used during regeneration to prevent duplicate dynamic characters.

---

## Selectors

Read-only query methods that derive data from the current world state.

### `getCharactersAtLocation(clusterId: string): Character[]`
- **Line:** 424
- **Description:** Returns discovered characters at a location.

---

### `getPlayerCharacter(): Character | null`
- **Line:** 432
- **Description:** Returns the player `Character` or `null`.

---

### `getMainConversation(): Conversation | null`
- **Line:** 438
- **Description:** Returns the main `Conversation` or `null`.

---

### `getOffscreenConversations(): Conversation[]`
- **Line:** 444
- **Description:** Returns all active off-screen conversations.

---

### `getCharacterById(id: string): Character | null`
- **Line:** 452
- **Description:** Returns a character by ID or `null`.

---

### `getLocationCluster(id: string): LocationCluster | null`
- **Line:** 458
- **Description:** Returns a location cluster by ID or `null`.

---

### `getDiscoveredCharacters(): Character[]`
- **Line:** 464
- **Description:** Returns all discovered non-player characters.

---

### `getAllLocations(): LocationCluster[]`
- **Line:** 470
- **Description:** Returns all location clusters.

---

## Persistence Configuration

- **Line:** 476
- **Storage key:** `'surat-world-storage'`
- **Custom storage adapter:** Reads/writes via the `/api/storage` REST endpoint. On read, falls back to `localStorage` for migration. On write, skips if `world` is `null` (prevents saving cleared state).
- **Partialize:** Only the `world` field is persisted.
