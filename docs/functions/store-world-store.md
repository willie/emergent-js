# store/world-store.ts

The primary game state store. Built with Zustand and persisted via a custom storage adapter that uses the `/api/storage` REST endpoint.

**Layer:** State Management

---

## Utility Functions

### `generateId(): string`
- **Line:** 16
- **Description:** Returns a new UUID via `crypto.randomUUID()`. Used for all entity IDs.

---

## Actions

All actions are methods on the Zustand store. They mutate `state.world` immutably via `set()`.

### `initializeScenario(config: ScenarioConfig): void`
- **Description:** Creates a new `WorldState` from a `ScenarioConfig`. Validates the config, generates UUIDs for all entities, creates `LocationCluster` objects from initial locations, resolves character starting positions, creates the player character, and sets the initial world state. Characters at the player's starting location are auto-discovered.

---

### `resetWorld(): void`
- **Description:** Sets `world` to `null` and `isSimulating` to `false`. Triggers the landing page.

---

### `advanceTime(ticks: number, narrativeTime?: string): void`
- **Description:** Adds `ticks` to `world.time.tick`. Optionally updates `narrativeTime`. Supports negative ticks for regeneration rollback.

---

### `moveCharacter(characterId: string, locationClusterId: string): void`
- **Description:** Updates a character's `currentLocationClusterId`.

---

### `addConversation(conversation: Omit<Conversation, 'id'>): Conversation`
- **Description:** Adds a new `Conversation` (with generated ID) to the world. Returns the created conversation.

---

### `addEvent(event: Omit<WorldEvent, 'id'>): void`
- **Description:** Appends a new `WorldEvent` (with generated ID) to `world.events`.

---

### `removeEventsBySourceId(messageId: string): void`
- **Description:** Removes all events whose `sourceMessageId` matches the given ID. Used during regeneration cleanup.

---

### `deduplicateEvents(): void`
- **Description:** Removes duplicate events by `timestamp + description` key. Sorts chronologically first to preserve order.

---

### `deduplicateConversations(): void`
- **Description:** Removes duplicate off-screen conversations by `locationClusterId + sorted participantIds + first message timestamp` signature.

---

### `deduplicateLocationClusters(): void`
- **Description:** Removes duplicate location clusters by normalized canonical name.

---

### `updateCharacterKnowledge(characterId: string, knowledge: Omit<KnowledgeEntry, 'id'>): void`
- **Description:** Appends a new `KnowledgeEntry` (with generated ID) to a character's knowledge array.

---

### `addLocationCluster(cluster: Omit<LocationCluster, 'id'>): LocationCluster`
- **Description:** Adds a new `LocationCluster` (with generated ID) to the world. Returns the created cluster.

---

### `addCharacter(character: Omit<Character, 'id'>): Character`
- **Description:** Adds a new `Character` (with generated ID) to the world. Returns the created character.

---

### `updateCharacter(characterId: string, updates: Partial<Character>): void`
- **Description:** Merges partial updates into a character's fields.

---

### `discoverCharacter(characterId: string): void`
- **Description:** Sets `isDiscovered: true` on the specified character.

---

### `setSimulating(simulating: boolean): void`
- **Description:** Sets the `isSimulating` flag (controls UI loading state).

---

### `removeCharactersByCreatorMessageId(messageId: string): void`
- **Description:** Removes all characters whose `createdByMessageId` matches. Used during regeneration to prevent duplicate dynamic characters.

---

## Selectors

Read-only query methods that derive data from the current world state.

### `getOffscreenConversations(): Conversation[]`
- **Description:** Returns all active off-screen conversations.

---

### `getCharacterById(id: string): Character | null`
- **Description:** Returns a character by ID or `null`.

---

### `getLocationCluster(id: string): LocationCluster | null`
- **Description:** Returns a location cluster by ID or `null`.

---

## Persistence Configuration

- **Storage key:** `STORAGE_KEYS.WORLD` (`'surat-world-storage'`)
- **Custom storage adapter:** Reads/writes via the `/api/storage` REST endpoint. On read, falls back to `localStorage` for migration. On write, skips if `world` is `null` (prevents saving cleared state).
- **Partialize:** Only the `world` field is persisted.
