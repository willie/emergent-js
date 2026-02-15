# components/chat/MainChatPanel.tsx

The primary chat component connecting the AI chat interface to the world state.

**Layer:** Components — Chat

---

## Component

### `MainChatPanel(): JSX.Element`
- **Line:** 78
- **Description:** The main chat panel React component. Wires together:
  - `useChat()` from the Vercel AI SDK for streaming chat.
  - `useChatPersistence()` for message/tool persistence.
  - `useWorldStore` selectors and actions for world state mutations.
  - Tool result processing via `processToolResult()`.
  - Message rendering with Markdown support.
  - Input form with Send and Continue buttons.

---

## Event Handlers

### `handleProcessToolResult(result, messageId, toolCallId): Promise<void>`
- **Line:** 142
- **Description:** Creates a `WorldActions` adapter from Zustand store actions and delegates to `processToolResult()`. This bridges the React component layer to the tool processing library.

---

### `handleSubmit(e: React.FormEvent): void`
- **Line:** 433
- **Description:** Form submit handler. Advances time by 1 tick, sends the user's input via `sendMessage()`, and clears the input field. Disabled during loading/simulation.

---

### `handleContinue(): void`
- **Line:** 442
- **Description:** Sends a `"__SURAT_CONTINUE__"` message to trigger another narrative response without user input. The continue message is cleaned up from history in the `onFinish` callback.

---

### `handleRegenerate(): void`
- **Line:** 318
- **Description:** Regenerates the last assistant response. Clears processed tool results for the message, removes dynamically-created characters and events tied to the message, reverts time cost (using negative ticks), and calls `regenerate()`.

---

### `handleEditMessage(messageId, content): void`
- **Line:** 448
- **Description:** Enters edit mode for a message by setting `editingNodeId` and `editContent` state.

---

### `handleDeleteMessage(messageIndex): void`
- **Line:** 453
- **Description:** Removes a message at the given index from the messages array.

---

### `handleRewindMessage(messageIndex): void`
- **Line:** 458
- **Description:** Truncates the message history to everything before the given index.

---

### `handleSaveEdit(messageId): void`
- **Line:** 467
- **Description:** Saves an edited message by replacing the text part content at the specified message ID.

---

### `handleProcessedToolsClear(): void`
- **Line:** 463
- **Description:** No-op callback. Persistence is handled automatically via `markToolProcessed`.

---

## Type Guards

### `isTextPart(part): part is TextPart`
- **Line:** 51
- **Description:** Returns `true` if the part has `type: 'text'` and a `text` property.

---

### `isToolResultPart(part): part is ToolResultPart`
- **Line:** 60
- **Description:** Returns `true` if the part has `type: 'tool-result'`.

---

### `isDynamicToolPart(part): part is DynamicToolPart`
- **Line:** 68
- **Description:** Returns `true` if the part's type string starts with `'tool-'`.

---

### `isToolResult(value): value is ToolResult`
- **Line:** 74
- **Description:** Returns `true` if the value is an object with a `type` property (loose check for `ToolResult` union).

---

## Effects

### History Repair (useEffect)
- **Line:** 180
- **Description:** Runs once per session after hydration. Performs three healing operations:
  1. **Heal processed tools:** If the world has advanced but the processed tools set is empty (lost persistence), scans all assistant messages and marks their tool invocations as processed.
  2. **Deduplicate events:** Calls `deduplicateEvents()` to clean up duplicate world events.
  3. **Deduplicate conversations:** Calls `deduplicateConversations()` to clean up duplicate off-screen conversations.
