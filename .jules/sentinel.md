## 2024-05-22 - [Arbitrary LLM Model Injection]
**Vulnerability:** The `/api/chat` endpoint accepted arbitrary `modelId` strings directly from the client request, allowing attackers to force the backend to use expensive or unauthorized models (e.g., GPT-4-32k) via `openrouter()`. This could lead to financial resource exhaustion (DoS) or bypass of intended model restrictions.
**Learning:** Never trust client-provided parameters that control resource allocation or backend logic, especially when they map directly to external API calls with cost implications. Always whitelist allowed values.
**Prevention:** Use a strict allowlist (e.g., `AVAILABLE_MODELS` constant) and validate incoming parameters using a schema library like Zod *before* using them in logic.
