## 2024-05-23 - The Hidden Cost of Icon-Only Buttons
**Learning:** Icon-only buttons (like edit/delete actions) are invisible to screen readers without explicit `aria-label`s, even if they have `title` attributes. `title` is often ignored by assistive technology or only shown on hover, excluding touch and keyboard users.
**Action:** Always pair icon-only buttons with `aria-label` describing the action, and mark the SVG icon as `aria-hidden="true"` to prevent "graphic" announcements.
