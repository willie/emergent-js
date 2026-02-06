## 2026-02-06 - Chat List Re-rendering
**Learning:** The chat list was re-rendering all messages on every token update because of inline mapping in `MainChatPanel`. This is a critical bottleneck in streaming chat apps.
**Action:** Extracted `ChatMessage` with `React.memo` and used stable callbacks via `messagesRef` to prevent unnecessary re-renders. This pattern should be applied to any streaming lists.
