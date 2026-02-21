## 2024-05-22 - System Role Injection Prevention
**Vulnerability:** The Chat API accepted any message role, potentially allowing users to inject `system` messages to override AI behavior.
**Learning:** `req.json()` must be validated before use. `z.any()` in Zod is too permissive for required object fields; use `z.object({}).passthrough()` to enforce object presence.
**Prevention:** Use a centralized Zod schema (`chatRequestSchema`) to strictly whitelist allowed message roles (`user`, `assistant`, `tool`, `data`) and reject `system`.
