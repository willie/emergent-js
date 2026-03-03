# lib/ai/openrouter.ts

OpenRouter AI SDK provider setup and model configuration.

**Layer:** Library — AI & Models

---

## Exports

### `openrouter`
- **Line:** 3
- **Description:** The OpenRouter provider instance created via `createOpenRouter()`. Configured with `OPENROUTER_API_KEY` from environment variables. Used as the model provider for all Vercel AI SDK calls.

---

### `models`
- **Line:** 8
- **Description:** A constant object mapping task names to model IDs:
  - `mainConversation`: `'z-ai/glm-4.6:exacto'` — Primary narrative generation and off-screen simulation.
  - `fast`: `'openai/gpt-4o-mini'` — Logic analysis, extraction, location resolution.
