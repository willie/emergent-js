# Sentinel's Journal

## 2026-02-20 - Unhandled JSON Parsing in API Routes
**Vulnerability:** API routes (`/api/chat`, `/api/simulate`, etc.) were calling `req.json()` without try-catch blocks. Sending malformed JSON caused the server to throw an unhandled exception (500 Internal Server Error).
**Learning:** Next.js API routes (and standard `Request.json()`) throw on invalid syntax. This is often overlooked when assuming clients always send valid JSON.
**Prevention:** Always wrap `req.json()` in a `try...catch` block in API handlers and return a 400 Bad Request on failure. Also, handle `null` body result by defaulting to empty object during destructuring (`const { ... } = body || {}`).
