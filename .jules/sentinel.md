# Sentinel's Journal

## 2026-02-11 - Unvalidated Model ID Injection
**Vulnerability:** API routes (`chat`, `simulate`) accepted arbitrary `modelId` strings from the client, passing them directly to the AI provider. This could allow users to use unauthorized or expensive models.
**Learning:** Even if `AVAILABLE_MODELS` is defined in the codebase, it must be explicitly enforced at the API boundary. Relying on the frontend to send valid IDs is insufficient.
**Prevention:** Always validate enum-like inputs against the allowlist using a helper function (like `isValidModelId`) before using them in sensitive operations.
