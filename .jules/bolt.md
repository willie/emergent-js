## 2025-02-18 - [Zustand Persistence to API]
**Learning:** Persisting Zustand state via `createJSONStorage` and API calls triggers a network request on *every* state update unless explicitly debounced. This can easily cause thousands of requests per session.
**Action:** Always wrap `setItem` logic in a debounce (e.g., 500-1000ms) when using `createJSONStorage` with an API backend.

## 2025-05-24 - Chat Rendering Optimization
**Learning:** `React.memo` for chat messages requires careful handling of callbacks. Simply memoizing the message component isn't enough; the parent must use `useCallback` for all handlers passed to it. Additionally, refactoring logic (like tool clearing) out of the child component into the stable handler in the parent is crucial to avoid passing unstable props like the full `messages` array or `processedTools` ref.
**Action:** Always check callback stability and prop stability when optimizing lists. Use `useRef` to access current state in callbacks without adding dependencies that break stability.
## 2026-03-02 - [O(N) to O(1) map lookup in render loops]
**Learning:** When a React component maps over an array and performs a `.find()` on another array inside each iteration, this results in an O(N*M) time complexity algorithm running during the render cycle, which can cause significant performance bottlenecks if either list gets large.
**Action:** Always pre-calculate a lookup `Map` using `useMemo` and then do an O(1) `.get()` inside the array `.map()` instead, reducing time complexity to O(N+M).
