## 2026-02-22 - System Role Prompt Injection
**Vulnerability:** The Chat API (`app/api/chat/route.ts`) blindly accepted messages with `role: 'system'` from the client, allowing users to override the system prompt.
**Learning:** `req.json()` must be validated against a strict schema. The `ai` SDK's `UIMessage` type allows 'system' role, but the application logic must filter it out for user-facing endpoints.
**Prevention:** Implemented strict input validation in `lib/chat/validation.ts` that rejects any message with `role: 'system'`.
