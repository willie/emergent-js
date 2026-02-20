## 2025-02-18 - [Zustand Persistence to API]
**Learning:** Persisting Zustand state via `createJSONStorage` and API calls triggers a network request on *every* state update unless explicitly debounced. This can easily cause thousands of requests per session.
**Action:** Always wrap `setItem` logic in a debounce (e.g., 500-1000ms) when using `createJSONStorage` with an API backend.

## 2025-05-24 - Chat Rendering Optimization
**Learning:** `React.memo` for chat messages requires careful handling of callbacks. Simply memoizing the message component isn't enough; the parent must use `useCallback` for all handlers passed to it. Additionally, refactoring logic (like tool clearing) out of the child component into the stable handler in the parent is crucial to avoid passing unstable props like the full `messages` array or `processedTools` ref.
**Action:** Always check callback stability and prop stability when optimizing lists. Use `useRef` to access current state in callbacks without adding dependencies that break stability.

## 2025-05-24 - ReactMarkdown Component Stability
**Learning:** `ReactMarkdown` props `components` and `remarkPlugins` break memoization if defined inline, causing unnecessary re-renders of the entire markdown tree even if text content is stable.
**Action:** Hoist `components` and `remarkPlugins` to module scope or `useMemo` when using `ReactMarkdown`.
