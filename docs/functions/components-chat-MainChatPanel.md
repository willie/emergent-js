# components/chat/MainChatPanel.tsx

The primary chat component connecting the AI chat interface to the world state.

**Layer:** Components — Chat

---

## Component

### `MainChatPanel(): JSX.Element`
- **Line:** 32
- **Description:** The main chat panel React component. Wires together:
  - `useChat()` from the Vercel AI SDK for streaming chat.
  - `useChatPersistence()` for message persistence (debounced).
  - `useWorldStore` for world state mutations (actions accessed via `getState()` for stability).
  - State delta application from assistant message metadata.
  - Input form with Send and Continue buttons.
- Message rendering is delegated to the `ChatMessage` component.

---

## Event Handlers

### `handleSubmit(e: React.FormEvent): void`
- **Description:** Form submit handler. Advances time by 1 tick, sends the user's input via `sendMessage()`, and clears the input field. Disabled during loading.

---

### `handleContinue(): void`
- **Description:** Sends a `CONTINUE_TRIGGER` message to trigger another narrative response without user input. The continue message is cleaned up from history in the `onFinish` callback.

---

### `handleRegenerate(): void`
- **Description:** Regenerates the last assistant response. Removes dynamically-created characters and events tied to the message, rolls back the state delta (time, movement), and calls `regenerate()`.

---

### `handleEditMessage(messageId, content): void`
- **Description:** Enters edit mode for a message by setting `editingNodeId` and `editContent` state.

---

### `handleDeleteMessage(messageIndex): void`
- **Description:** Removes the message at the given index from the messages array.

---

### `handleRewindMessage(messageIndex): void`
- **Description:** Truncates the message history to everything before the given index.

---

### `handleSaveEdit(messageId, content): void`
- **Description:** Saves an edited message by replacing the text part content at the specified message ID with the provided content.

---

## Effects

### State Delta Application (useEffect)
- **Description:** Watches for new assistant messages with `metadata.stateDelta`. Uses an `appliedDeltas` ref (seeded on hydration) to track which messages have been applied. For each new delta: applies time advances, resolves movement (creating location clusters if needed), moves characters, discovers characters, and triggers simulation when flagged.
