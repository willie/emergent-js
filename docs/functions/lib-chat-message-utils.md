# lib/chat/message-utils.ts

Type definitions, type guards, and utilities for chat message parts.

**Layer:** Library — Chat Processing

---

## Interfaces

### `TextPart`
- **Line:** 1
- **Fields:** `type: "text"`, `text: string`

---

## Type Guards

### `isTextPart(part): part is TextPart`
- **Line:** 6
- **Description:** Returns `true` if the part has `type: "text"` and a `text` property.

---

## Constants

### `CONTINUE_TRIGGER`
- **Line:** 15
- **Description:** The sentinel string `"__SURAT_CONTINUE__"` used to identify programmatically-sent continue messages.

---

## Helpers

### `isContinueTrigger(message): boolean`
- **Line:** 20
- **Description:** Returns `true` if the message is a continue-trigger (sent programmatically, not by the user). Checks both the AI SDK `parts` array format and raw `content` string format.
