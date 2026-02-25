# lib/hooks/use-chat-persistence.ts

Hook and utilities for chat message and tool processing persistence.

**Layer:** Library — Hooks

---

## Functions

### `useChatPersistence({ setMessages }): UseChatPersistenceResult`
- **Line:** 123
- **Description:** React hook that manages the persistence lifecycle for chat messages and processed tool state. On mount, loads stored messages and processed tools from the storage API. Returns refs and callbacks for marking tools as processed, clearing tools, and persisting messages.
- **Returns:** `{ processedTools, markToolProcessed, clearProcessedTool, isHydrated, clearAll, persistMessages }`.

---

### `clearChatStorage(): Promise<void>`
- **Line:** 86
- **Description:** Clears all chat-related storage for the current save slot by writing empty arrays to both the messages and processed tools storage keys.

---

### `loadStoredMessages(): Promise<UIMessage[]>`
- **Line:** 7
- **Description:** Loads chat messages from the storage API for the current save slot. Falls back to `localStorage` for migration from the legacy storage format. Returns an empty array on failure.

---

### `saveMessages(messages: UIMessage[]): Promise<void>`
- **Line:** 29
- **Description:** Persists the current chat messages to the storage API under the current slot's message key.

---

### `loadProcessedTools(): Promise<Set<string>>`
- **Line:** 45
- **Description:** Loads the set of processed tool keys from the storage API. Falls back to `localStorage` for legacy migration. Returns an empty `Set` on failure.

---

### `saveProcessedTools(tools: Set<string>): Promise<void>`
- **Line:** 67
- **Description:** Persists the processed tools set (converted to an array) to the storage API.
