# components/chat/ChatMessage.tsx

Memoized component for rendering individual chat messages.

**Layer:** Components — Chat

---

## Component

### `ChatMessage(props): JSX.Element | null`
- **Line:** 25
- **Description:** A `React.memo`-wrapped component that renders a single chat message. Handles:
  - Hiding auto-continue trigger messages (`"Continue"` / `"__SURAT_CONTINUE__"`).
  - Positioning (right-aligned for user, left-aligned for assistant).
  - Markdown rendering via `ReactMarkdown` with GFM support and styled prose.
  - Edit mode with a textarea, Save, and Cancel buttons.
  - `MessageActions` buttons (edit, delete, rewind) on both user and assistant messages.
  - A "Regenerate" button on the last assistant message.

---

## Props

### `ChatMessageProps`
- **Line:** 10
- **Fields:**
  - `message: UIMessage` — The message to render.
  - `index: number` — The message's position in the messages array.
  - `isLastAssistant: boolean` — Whether this is the final assistant message (enables regenerate button).
  - `isEditing: boolean` — Whether this message is currently in edit mode.
  - `editContent: string` — The current text in the edit textarea.
  - `onEditContentChange(content): void` — Called when the edit textarea value changes.
  - `onEdit(messageId, content): void` — Called to enter edit mode.
  - `onDelete(messageIndex): void` — Called to delete this message.
  - `onRewind(messageIndex): void` — Called to rewind to this message.
  - `onSaveEdit(messageId): void` — Called to save the edited content.
  - `onCancelEdit(): void` — Called to cancel editing.
  - `onRegenerate?(): void` — Called to regenerate the last assistant response.
