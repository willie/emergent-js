## 2025-02-18 - [Zustand Persistence to API]
**Learning:** Persisting Zustand state via `createJSONStorage` and API calls triggers a network request on *every* state update unless explicitly debounced. This can easily cause thousands of requests per session.
**Action:** Always wrap `setItem` logic in a debounce (e.g., 500-1000ms) when using `createJSONStorage` with an API backend.

## 2025-05-24 - Chat Rendering Optimization
**Learning:** `React.memo` for chat messages requires careful handling of callbacks. Simply memoizing the message component isn't enough; the parent must use `useCallback` for all handlers passed to it. Additionally, refactoring logic (like tool clearing) out of the child component into the stable handler in the parent is crucial to avoid passing unstable props like the full `messages` array or `processedTools` ref.
**Action:** Always check callback stability and prop stability when optimizing lists. Use `useRef` to access current state in callbacks without adding dependencies that break stability.

## 2025-06-15 - React List Lookup Optimization
**Learning:** When rendering lists of components (e.g., characters in `CharacterPanel`) that require cross-referencing another array (e.g., `locationClusters`), using `.find()` inside the `.map()` loop causes O(N*M) complexity on every render.
**Action:** Always pre-calculate a `Map` of the target array using `useMemo` to convert the rendering lookup to O(1) and overall complexity to O(N+M). This is particularly important for game state lists that re-render frequently.