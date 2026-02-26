## 2024-05-22 - [Interactive Cards Accessibility]
**Learning:** Interactive cards implemented as `div` with `onClick` lack keyboard accessibility and screen reader support.
**Action:** Use semantic `<button>` elements with `w-full text-left` for card-like interactive areas. Ensure nested actions are siblings, not children, to avoid invalid HTML.
