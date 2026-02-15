## 2024-05-23 - Validate Model IDs
**Vulnerability:** The `modelId` parameter in API routes (`api/chat`, `api/simulate`) was used without validation, allowing potential unauthorized model usage or injection of arbitrary strings into the AI provider.
**Learning:** Even if the AI provider handles invalid model IDs gracefully, strictly validating inputs against an allowlist (`AVAILABLE_MODELS`) on the server side is crucial for security and predictability. It prevents "model injection" and ensures only approved models are used.
**Prevention:** Added `isValidModelId` helper and integrated it into all API routes accepting `modelId`.
