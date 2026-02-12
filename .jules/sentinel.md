## 2025-02-23 - Unvalidated Model ID Injection
**Vulnerability:** The `modelId` parameter in the chat API was used directly to instantiate a model client without validation. An attacker could potentially use any model ID supported by the provider, leading to unauthorized usage or cost overruns.
**Learning:** Frontend constraints (dropdowns) are insufficient security controls. API endpoints must independently validate all inputs against strict allowlists.
**Prevention:** Implement strict type guards and validation functions for all user-provided configuration parameters before use.
