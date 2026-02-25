# Sentinel's Journal

## 2024-05-23 - API Input Validation Crash
**Vulnerability:** The `/api/chat` endpoint was vulnerable to server crashes (500 Internal Server Error) when receiving malformed JSON or invalid data structures, as `req.json()` was not wrapped in a try-catch block and the result was cast without validation.
**Learning:** Next.js API routes do not automatically handle JSON parsing errors gracefully. Explicit try-catch blocks are required.
**Prevention:** Always wrap `req.json()` in try-catch and use a runtime validation library like Zod (`.safeParse()`) to validate the request body before using it.
