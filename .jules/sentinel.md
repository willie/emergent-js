## 2025-02-12 - [Critical] Model Injection Vulnerability in Next.js AI SDK Routes
**Vulnerability:** The `modelId` parameter from the client was passed directly to the `openrouter` function in `app/api/chat/route.ts` and `app/api/simulate/route.ts`, allowing execution of unauthorized or expensive AI models.
**Learning:** Next.js App Router handlers consuming JSON bodies must explicitly validate all input fields, especially those controlling external service calls. The Vercel AI SDK does not validate model identifiers by default.
**Prevention:** Always validate `modelId` against a strict allowlist (e.g., `isValidModelId`) before initializing the AI model client.
