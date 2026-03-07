## 2024-03-07 - Missing parseSafeJson utility
**Vulnerability:** API endpoints use `req.json()` directly which allows unbounded JSON payload parsing.
**Learning:** Unbounded JSON payloads can cause Node.js process to run out of memory (DoS). Furthermore, failing to validate parsed JSON types before using methods like `.replace()` (e.g. `const cleanKey = key.replace(...)`) allows unhandled exception vectors.
**Prevention:** Use a `parseSafeJson` utility to safely stream and enforce `Content-Length` limits on JSON request bodies. Always validate that parsed properties are the expected type (e.g. `typeof key === 'string'`) before invoking methods on them.
