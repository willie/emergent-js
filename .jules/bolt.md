## 2024-05-23 - Stable Handlers for Large Lists
**Learning:** To prevent re-renders of memoized list items (`ChatMessage`) when parent state (`messages`) changes, use the Ref pattern for handlers. Instead of `useCallback` depending on `messages` (which recreates the handler every render), use a `messagesRef` that updates in `useEffect`, and read `messagesRef.current` inside the stable callback.
**Action:** Apply this pattern when optimizing large lists where handlers need access to the latest list state but shouldn't trigger item re-renders.
