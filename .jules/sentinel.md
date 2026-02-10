# Sentinel's Journal

## 2025-02-12 - [Missing API Input Validation]
**Vulnerability:** The `/api/chat` endpoint accepts arbitrary `modelId` and payload without validation, potentially allowing model injection (using unauthorized models) or DoS via malformed payloads.
**Learning:** Trusting client input directly (e.g. `req.json() as Type`) is risky even in internal-facing apps. Always validate at the boundary.
**Prevention:** Implementing Zod schema validation for all API routes ensures only expected data structures and allowed values (like `AVAILABLE_MODELS`) are processed.
