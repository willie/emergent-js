## 2025-02-18 - [Zustand Persistence to API]
**Learning:** Persisting Zustand state via `createJSONStorage` and API calls triggers a network request on *every* state update unless explicitly debounced. This can easily cause thousands of requests per session.
**Action:** Always wrap `setItem` logic in a debounce (e.g., 500-1000ms) when using `createJSONStorage` with an API backend.
