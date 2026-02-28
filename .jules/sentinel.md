## 2026-02-28 - Missing path traversal check in Storage API
**Vulnerability:** Path traversal possible in `app/api/storage/route.ts` GET list endpoint via `searchParams.get('list')`.
**Learning:** Even if explicit keys are sanitized with `cleanKey`, list operations or other params might not be validated.
**Prevention:** Sanitize all inputs before using them in file system operations.
