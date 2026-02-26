## 2025-05-27 - [HIGH] Missing Input Validation on Chat API

**Vulnerability:** The `/api/chat` endpoint trusts the `req.json()` output implicitly, assuming `messages` and `worldState` exist and have the correct structure.
**Learning:** `req.json()` only validates that the body is valid JSON, not that it matches the expected schema. Malformed payloads can cause crashes or unexpected behavior.
**Prevention:** Always validate API inputs using a schema library like Zod. Use `safeParse` to handle validation errors gracefully and return a 400 Bad Request.
