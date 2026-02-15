# lib/chat/message-utils.ts

Type definitions and type guards for chat message parts.

**Layer:** Library — Chat Processing

---

## Interfaces

### `TextPart`
- **Line:** 4
- **Fields:** `type: "text"`, `text: string`

### `ToolResultPart`
- **Line:** 9
- **Fields:** `type: "tool-result"`, `toolCallId: string`, `result: unknown`

### `DynamicToolPart`
- **Line:** 15
- **Fields:** `type: string`, `state?: string`, `output?: unknown`, `toolCallId?: string`

---

## Type Guards

### `isTextPart(part): part is TextPart`
- **Line:** 22
- **Description:** Returns `true` if the part has `type: "text"` and a `text` property.

### `isToolResultPart(part): part is ToolResultPart`
- **Line:** 31
- **Description:** Returns `true` if the part has `type: "tool-result"`.

### `isDynamicToolPart(part): part is DynamicToolPart`
- **Line:** 39
- **Description:** Returns `true` if the part's type string starts with `"tool-"`.

### `isToolResult(value): value is ToolResult`
- **Line:** 45
- **Description:** Returns `true` if the value is an object with a `type` property (loose check for the `ToolResult` union from `tool-processor.ts`).

---

## Helpers

### `getToolKeysForMessage(message: UIMessage): string[]`
- **Line:** 49
- **Description:** Extracts all tool-related keys from a message for use with the `processedTools` set. Scans both legacy `toolInvocations` and the `parts` array. Returns keys in the format `"<messageId>-<toolCallId>"` for invocations and tool-result parts, with fallback formats for dynamic tool parts without a `toolCallId`.
