# app/api/chat/route.ts

The main narrative generation endpoint. Implements a 3-stage pipeline: Logic Analysis, Action Execution, and Narration.

**Layer:** API Route (Server)

---

## Functions

### `POST(req: Request): Promise<Response>`
- **Line:** 18
- **Description:** Handles chat requests. Parses `{ messages, worldState, modelId }` from the request body. Executes the 3-stage pipeline:
  1. **Stage 1 — Logic Analysis:** If the last message is from the user (not a tool result), calls `analyzePlayerIntent()` to detect game actions (movement, time advance, character discovery).
  2. **Stage 2 — Action Execution:** If tool calls were detected, uses the OpenAI client directly to emit tool calls via a streaming SSE response. Returns immediately — the narrator is not invoked.
  3. **Stage 3 — Narration:** If no tool calls were detected (or the request is a tool result follow-up), streams a narrative response using `streamText()` from the Vercel AI SDK with zero tools.
- **Returns:** An SSE stream — either raw OpenAI chunks (Stage 2) or a `UIMessageStreamResponse` (Stage 3).

---

### `buildSystemPrompt(world: WorldState): string`
- **Line:** 159
- **Description:** Constructs the narrator's system prompt from the current world state. Includes: scenario description, current location, other known locations, narrative time, present characters with their last 3 knowledge entries, undiscovered characters as hints, and recent events (last 5). Defines the narrator's role and behavioral guidelines.
- **Returns:** A complete system prompt string.
