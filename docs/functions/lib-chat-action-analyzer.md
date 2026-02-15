# lib/chat/action-analyzer.ts

Stage 1 of the chat pipeline. Analyzes player input to determine game actions.

**Layer:** Library — Chat Processing

---

## Internal

### `openai`
- **Line:** 6
- **Description:** An `OpenAI` client instance configured to use the OpenRouter API base URL. Used for direct API calls that bypass the Vercel AI SDK (to avoid Zod 4 compatibility issues with tool schemas).

---

### `GAME_TOOLS_CUSTOM_SCHEMA`
- **Line:** 12
- **Description:** An array of three `ChatCompletionTool` objects defining the game tools as raw JSON Schema. Avoids Zod schema generation to prevent SDK incompatibility.

---

## Functions

### `analyzePlayerIntent(messages: any[], worldState: WorldState, modelId?: string): Promise<AnalyzerResult>`
- **Line:** 73
- **Description:** Sends the conversation history (converted to OpenAI format) along with a system prompt describing the current world state to a fast LLM. The LLM is given the three game tools (`moveToLocation`, `advanceTime`, `discoverCharacter`) with `tool_choice: 'auto'`. Parses any tool calls from the response into `SimpleToolCall[]`.
- **Returns:** `{ toolCalls, context }` where `context` is always an empty string.
- **Side effects:** Logs detected tool calls to the console.
