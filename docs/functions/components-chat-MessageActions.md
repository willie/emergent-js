# components/chat/MessageActions.tsx

Action buttons (edit, delete, rewind) for individual chat messages.

**Layer:** Components — Chat

---

## Component

### `MessageActions(props): JSX.Element`
- **Line:** 37
- **Description:** Renders three icon buttons for each message: Edit, Delete, and Rewind.

---

## Event Handlers

### `handleEdit(): void`
- **Line:** 44
- **Description:** Finds the text part of the message and calls `onEdit` with the message ID and text content.

---

### `handleDelete(): void`
- **Line:** 51
- **Description:** Calls `onDelete(messageIndex)`. Tool key cleanup is handled by `MainChatPanel`.

---

### `handleRewind(): void`
- **Line:** 55
- **Description:** Calls `onRewind(messageIndex)`. Tool key cleanup is handled by `MainChatPanel`.

---

## Icon Components

### `EditIcon(): JSX.Element`
- **Line:** 13
- **Description:** Renders a pencil SVG icon (14x14).

---

### `DeleteIcon(): JSX.Element`
- **Line:** 21
- **Description:** Renders a trash can SVG icon (14x14).

---

### `RewindIcon(): JSX.Element`
- **Line:** 29
- **Description:** Renders a circular rewind arrow SVG icon (14x14).
