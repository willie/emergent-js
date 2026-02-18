## 2024-05-23 - Nested Interactive Elements in Character List
**Learning:** Found a pattern of nesting a clickable `span` inside a `button` in `CharacterPanel.tsx`. This creates invalid HTML and blocks keyboard access to the inner element.
**Action:** Use a flex container with sibling buttons instead of nesting. Ensure the primary action (expand) takes up the remaining space, and secondary actions (edit) are separate focusable buttons.
