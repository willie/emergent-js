# lib/hooks/use-chat-persistence.ts

Hook and utilities for chat message persistence.

**Layer:** Library — Hooks

---

## Functions

### `useChatPersistence({ setMessages }): UseChatPersistenceResult`
- **Line:** 54
- **Description:** React hook that manages the persistence lifecycle for chat messages. On mount, loads stored messages from the storage API and hydrates the chat. The `persistMessages` callback is debounced (2 seconds) to prevent network request storms during streaming.
- **Returns:** `{ isHydrated, persistMessages }`.

---

### `clearChatStorage(): Promise<void>`
- **Line:** 37
- **Description:** Clears all chat-related storage for the current save slot by writing an empty array to the messages storage key.

---

### `loadStoredMessages(): Promise<UIMessage[]>`
- **Line:** 8
- **Description:** Loads chat messages from the storage API for the current save slot. Falls back to `localStorage` for migration from the legacy storage format. Returns an empty array on failure.

---

### `saveMessages(messages: UIMessage[]): Promise<void>`
- **Line:** 25
- **Description:** Persists the current chat messages to the storage API under the current slot's message key.
