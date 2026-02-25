# lib/chat/tool-processor.ts

Processes tool call results and applies world state mutations.

**Layer:** Library — Chat Processing

---

## Functions

### `processToolResult(result: ToolResult, messageId: string, toolCallId: string, options: ProcessToolResultOptions): Promise<void>`
- **Line:** 160
- **Description:** The main tool processing function. Handles three result types:
  - **`movement`:** Resolves the destination via the location API (with a manual fallback using `extractCanonicalName`). Creates a new `LocationCluster` if needed. Moves the player and any accompanied characters. Triggers off-screen simulation if enough time has passed and the player changed locations. Advances time.
  - **`time_advance`:** Advances the world clock by the specified ticks and updates narrative time.
  - **`character_discovery`:** Finds the character by fuzzy name matching. If found, marks them as discovered. If not found, creates a new `Character` at the player's location, tagged with `createdByMessageId` for cleanup on regeneration.
- **Deduplication:** Uses `processedTools` set with key `${messageId}-${toolCallId}` to prevent double-processing.

---

### `resolveLocationViaApi(description: string, existingClusters: LocationCluster[], modelId: string): Promise<ResolveLocationResult | null>`
- **Line:** 85
- **Description:** Client-side wrapper that calls `POST /api/locations/resolve`. Returns the resolution result or `null` on failure.

---

### `runSimulationViaApi(worldState: WorldState, playerLocationClusterId: string, timeSinceLastSimulation: number, modelId: string): Promise<SimulationResult | null>`
- **Line:** 110
- **Description:** Client-side wrapper that calls `POST /api/simulate`. Returns the simulation result or `null` on failure.

---

### `normalizeName(name: string): string`
- **Line:** 44
- **Description:** Normalizes a character name for fuzzy matching by lowercasing and removing non-word characters.

---

### `findBestCharacterMatch(searchName: string, characters: Character[]): { id: string; name: string } | null`
- **Line:** 54
- **Description:** Finds the best matching character using progressive strategies:
  1. Exact case-insensitive match.
  2. Normalized exact match.
  3. Substring match (either name contains search or search contains name).
- **Returns:** The matched character's `{ id, name }` or `null`.
