# Palette's Journal

## 2024-05-24 - Accessibility of Loading Buttons
**Learning:** Buttons that replace their text with a loading spinner lose their accessible name if not explicitly handled. A button containing only an SVG (even if the SVG has a title) often reads as just "button" or nothing to screen readers.
**Action:** Always ensure `aria-label` is present and descriptive (e.g., "Sending message") on the button element itself when switching to a loading state, and mark the spinner SVG with `aria-hidden="true"`.
