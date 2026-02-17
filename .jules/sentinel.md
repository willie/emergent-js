## 2025-02-21 - Prompt Injection via Chat Input
**Vulnerability:** The `/api/chat` endpoint accepted raw user input without validating the `messages` structure or roles. An attacker could inject messages with `role: 'system'` to override the system prompt.
**Learning:** `req.json()` output in Next.js route handlers is untrusted and must be validated. The `ai` SDK's `convertToModelMessages` does not inherently block system messages if they are passed in the UI message format.
**Prevention:** Always validate API input using a dedicated validation function (e.g., `lib/chat/validation.ts`) before processing. Explicitly reject or filter sensitive roles like `system` from user-controlled input.
