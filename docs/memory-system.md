# Memory System Architecture

The Emergent JS memory system is designed to simulate a living world where characters only know what they have personally witnessed or been told. However, the implementation differs between "off-screen" simulation and "on-screen" direct interaction.

## 1. Core Data Structures

The system uses two primary mechanisms to track knowledge:

### World Events (`WorldEvent`)
Every significant action in the world (movement, conversation, object interaction) is recorded as a `WorldEvent`.
- **`witnessedByIds`**: This field explicitly lists the IDs of all characters who were present and saw the event occur.
- **`isOffscreen`**: Flags whether the event happened during background simulation or active player interaction.

### Character Knowledge (`Character.knowledge`)
Each character has a personal `knowledge` array containing `KnowledgeEntry` objects.
- **Content**: A text summary of the fact or event.
- **Source**: How they learned it (`witnessed`, `told`, `inferred`).
- **AcquiredAt**: The tick timestamp when the memory was formed.

## 2. Off-Screen Simulation (Strict Witnessing)

When the player is not present, the world is simulated via `lib/world/simulation.ts`.

1.  **Grouping**: Characters are grouped by location.
2.  **Interaction**: An LLM simulates their interaction based *only* on the characters present.
3.  **Event Generation**: The simulation produces events.
4.  **Knowledge Distribution**: The system automatically assigns these events as new `KnowledgeEntry` items *only* to the characters in that location group (`witnessedByIds`).

This ensures that if Character A and B are in the Tavern, they will form memories of their conversation, but Character C in the Forest will know nothing about it.

## 3. On-Screen / Active Context (Global Narrative with Constraints)

When the player is present (the "Main Chat"), the architecture changes slightly to accommodate the LLM's role as a coherent Game Master.

-   **Global Context**: The `app/api/chat/route.ts` provides the LLM with a list of `recentEvents` from the global log.
-   **Leaky Context Risk**: Technically, the LLM "sees" everything that just happened, even if the current NPCs shouldn't know it.
-   **Mitigation**: The system prompt explicitly instructs the Narrator: *"Characters should only know what they have witnessed or been told."*
-   **Short-term Memory**: Characters currently in the scene rely on the "Chat History" (the sliding context window) rather than querying their long-term `knowledge` database for immediate interactions.

## 4. Knowledge Propagation

-   **Direct Witnessing**: Handled automatically by the simulation (off-screen) or the shared context window (on-screen).
-   **Being Told**: Currently, there is not a dedicated distinct mechanic for "Gossip Propagation" (e.g., A tells B about event X, so B gains knowledge of X with source `told`). This happens implicitly if characters discuss it during a simulation, but it is not structured data yet.
