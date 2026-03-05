## 2025-03-05 - Missing API Parameter Type Safety
**Vulnerability:** API endpoints using `req.json()` directly unpacked JSON payloads and assumed properties like `key` were strictly strings, allowing objects or arrays to trigger a crash (500) if methods like `key.replace()` were called on them. Also, `req.json()` does not enforce strict limits chunk-by-chunk on large JSON payloads.
**Learning:** Type checking primitives after `req.json()` parsing or strictly utilizing a tool like Zod to parse parameters is necessary for external endpoints.
**Prevention:** Use type checks like `typeof key === 'string'` prior to invoking string methods on unknown inputs and consistently utilize `parseSafeJson` for limiting payload bounds dynamically for any external request.
