# components/chat/MainChatPanel.tsx

The primary chat component connecting the AI chat interface to the world state.

**Layer:** Components — Chat

---

## Component

### `MainChatPanel(): JSX.Element`
- **Line:** 38
- **Description:** The main chat panel React component. Wires together:
  - `useChat()` from the Vercel AI SDK for streaming chat.
  - `useChatPersistence()` for message/tool persistence.
  - `useWorldStore` selectors and actions for world state mutations.
  - Tool result processing via `processToolResult()`.
  - Input form with Send and Continue buttons.
- Message rendering is delegated to the `ChatMessage` component.

---

## Event Handlers

### `handleProcessToolResult(result, messageId, toolCallId): Promise<void>`
- **Line:** 110
- **Description:** Creates a `WorldActions` adapter from Zustand store actions and delegates to `processToolResult()`. This bridges the React component layer to the tool processing library.

---

### `handleSubmit(e: React.FormEvent): void`
- **Line:** 398
- **Description:** Form submit handler. Advances time by 1 tick, sends the user's input via `sendMessage()`, and clears the input field. Disabled during loading/simulation.

---

### `handleContinue(): void`
- **Line:** 407
- **Description:** Sends a `"__SURAT_CONTINUE__"` message to trigger another narrative response without user input. The continue message is cleaned up from history in the `onFinish` callback.

---

### `handleRegenerate(): void`
- **Line:** 274
- **Description:** Regenerates the last assistant response. Clears processed tool results for the message, removes dynamically-created characters and events tied to the message, reverts time cost (using negative ticks), and calls `regenerate()`.

---

### `handleEditMessage(messageId, content): void`
- **Line:** 413
- **Description:** Enters edit mode for a message by setting `editingNodeId` and `editContent` state.

---

### `handleDeleteMessage(messageIndex): void`
- **Line:** 427
- **Description:** Clears processed tool keys for the message (via `getToolKeysForMessage`) and removes it from the messages array.

---

### `handleRewindMessage(messageIndex): void`
- **Line:** 438
- **Description:** Clears processed tool keys for the target message and all subsequent messages, then truncates the history to everything before the given index.

---

### `handleSaveEdit(messageId): void`
- **Line:** 451
- **Description:** Saves an edited message by replacing the text part content at the specified message ID.

---

## Effects

### History Repair (useEffect)
- **Line:** 155
- **Description:** Runs once per session after hydration. Performs three healing operations:
  1. **Heal processed tools:** If the world has advanced but the processed tools set is empty (lost persistence), scans all assistant messages and marks their tool invocations as processed.
  2. **Deduplicate events:** Calls `deduplicateEvents()` to clean up duplicate world events.
  3. **Deduplicate conversations:** Calls `deduplicateConversations()` to clean up duplicate off-screen conversations.
