## 2025-02-18 - Unhandled JSON Parsing in API Routes

**Vulnerability:** Multiple API routes (`/api/chat`, `/api/simulate`, etc.) used `await req.json()` without try/catch blocks. Sending malformed JSON caused unhandled exceptions and 500 Internal Server Errors.

**Learning:** Next.js App Router route handlers do not automatically catch JSON parsing errors from `req.json()`. Developers often assume the framework handles this or that clients always send valid JSON.

**Prevention:** Always wrap `req.json()` calls in a `try...catch` block in API route handlers and return a 400 Bad Request response if parsing fails. This prevents server crashes/stack trace leaks and provides better feedback to clients.
