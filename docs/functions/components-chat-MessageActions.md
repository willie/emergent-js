# components/chat/MessageActions.tsx

Action buttons (edit, delete, rewind) for individual chat messages.

**Layer:** Components — Chat

---

## Component

### `MessageActions(props): JSX.Element`
- **Line:** 50
- **Description:** Renders three icon buttons for each message: Edit, Delete, and Rewind. Handles clearing processed tool results when messages are deleted or rewound.

---

## Event Handlers

### `handleEdit(): void`
- **Line:** 60
- **Description:** Finds the text part of the message and calls `onEdit` with the message ID and text content.

---

### `handleDelete(): void`
- **Line:** 67
- **Description:** Clears processed tool keys for this message from the `processedToolResults` ref, then calls `onDelete`.

---

### `handleRewind(): void`
- **Line:** 77
- **Description:** Clears processed tool keys for this message and all subsequent messages, then calls `onRewind`.

---

## Helpers

### `getToolKeysForMessage(message): string[]`
- **Line:** 40
- **Description:** Extracts all tool-related part keys from a message (parts whose type starts with `'tool-'`). Returns `["<messageId>-<partType>", ...]`.

---

## Icon Components

### `EditIcon(): JSX.Element`
- **Line:** 16
- **Description:** Renders a pencil SVG icon (14x14).

---

### `DeleteIcon(): JSX.Element`
- **Line:** 24
- **Description:** Renders a trash can SVG icon (14x14).

---

### `RewindIcon(): JSX.Element`
- **Line:** 32
- **Description:** Renders a circular rewind arrow SVG icon (14x14).
