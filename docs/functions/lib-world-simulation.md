# lib/world/simulation.ts

The simulation engine that generates off-screen character dialogues and events.

**Layer:** Library — World Simulation

---

## Functions

### `simulateOffscreen(world: WorldState, playerLocationClusterId: string, timeSinceLastSimulation: number, modelId?: string, relevantEvents?: WorldEvent[]): Promise<{ events, conversations, characterUpdates }>`
- **Line:** 233
- **Description:** The primary entry point for off-screen simulation. Filters for discovered NPCs not at the player's location, groups them by location, and for each group with 2+ characters, determines simulation depth and runs the appropriate simulation (full dialogue or summary). Aggregates results across all location groups.
- **Returns:** `{ events: WorldEvent[], conversations: Omit<Conversation, 'id'>[], characterUpdates: { characterId, newLocationId }[] }`.

---

### `runFullSimulation(characters: Character[], locationName: string, timeElapsed: number, world: WorldState, modelId?: string, relevantEvents?: WorldEvent[]): Promise<{ events, messages, conversation, movements }>`
- **Line:** 73
- **Description:** Generates a full dialogue between characters at a location. Constructs a detailed prompt including character descriptions, goals, relationships, shared history, and available locations. The turn count scales with elapsed time (up to 8 exchanges). After generating dialogue, a second LLM call uses the `reportSimulation` tool to extract structured events and movements. Resolves character and location names to IDs.
- **Returns:** `{ events: WorldEvent[], messages: Message[], conversation: Omit<Conversation, 'id'>, movements: { characterId, newLocationId }[] }`.

---

### `generateSummary(characters: Character[], locationName: string, timeElapsed: number, world: WorldState, modelId?: string): Promise<WorldEvent>`
- **Line:** 38
- **Description:** Generates a brief 1–2 sentence summary of what characters did during the elapsed time. Used for `'summary'` depth simulation.
- **Returns:** A `WorldEvent` marked as `isOffscreen: true`.

---

### `determineSimulationDepth(timeSinceLastInteraction: number, hasUnresolvedPlotPoints: boolean): SimulationDepth`
- **Line:** 12
- **Description:** Determines how deeply to simulate based on elapsed time:
  - `< 5` ticks → `'skip'`
  - `> 20` ticks or unresolved plot → `'full'`
  - `> 10` ticks → `'summary'`
  - Otherwise → `'skip'`

---

### `groupCharactersByLocation(characters: Character[]): Map<string, Character[]>`
- **Line:** 25
- **Description:** Groups an array of characters into a `Map` keyed by `currentLocationClusterId`. Used to identify which characters can interact at each location.
