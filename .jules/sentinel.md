## 2024-03-02 - Missing Input Sanitization Checks

**Vulnerability:**
The `app/api/storage/route.ts` API processes user input (`key`) from URL search params and parsed JSON bodies.
1. It fails to validate that `typeof key === 'string'` from JSON parsed bodies before calling string methods like `.replace()`, causing Unhandled Exceptions (500 Server Errors) if the parsed JSON contains an array or object.
2. It assumes that calling `key.replace(/[^a-zA-Z0-9_-]/g, '')` always yields a valid non-empty string. If an attacker passes purely invalid characters (e.g., `key=../../../`), `cleanKey` becomes an empty string (`""`), which the server blindly uses to build `path.join(DATA_DIR, ".json")`. This risks overwriting or retrieving arbitrary data.

**Learning:**
Security inputs that are mutated/sanitized must always be re-evaluated to verify they still contain valid, expected content before being used in sensitive path resolution or DB queries.

**Prevention:**
Always validate `typeof key === 'string'` when pulling inputs from `req.json()` that bypass Zod validation. Always check `if (!cleanKey)` after sanitization to ensure the input isn't structurally empty.
