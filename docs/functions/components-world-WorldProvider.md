# components/world/WorldProvider.tsx

Hydration gate for the Zustand persisted store.

**Layer:** Components — World

---

## Component

### `WorldProvider({ children }): JSX.Element`
- **Line:** 23
- **Description:** Wraps children in a hydration check. Uses `useSyncExternalStore` to subscribe to the Zustand persist middleware's hydration state. Shows "Loading..." until the store has finished hydrating from the storage API. Does not block on `world === null` — that's handled by `GameLayout`.

---

## Helper Functions

### `subscribeToHydration(callback: () => void): () => void`
- **Line:** 10
- **Description:** Subscription function for `useSyncExternalStore`. Listens to the Zustand persist middleware's `onFinishHydration` event.

---

### `getHydrated(): boolean`
- **Line:** 15
- **Description:** Snapshot function for `useSyncExternalStore`. Returns whether the store has finished hydrating.

---

### `getServerHydrated(): boolean`
- **Line:** 19
- **Description:** Server snapshot function. Always returns `false` (SSR always shows loading state).
