## 2024-03-07 - Accessibility for Disclosure Widgets
**Learning:** Expandable/collapsible panels (disclosure widgets) must include `aria-expanded={boolean}` on the toggle button and `aria-hidden="true"` on decorative inner elements like chevron icons to ensure screen readers can properly interpret the state and skip redundant visual cues.
**Action:** Always include `aria-expanded` and `aria-hidden` attributes when implementing expandable components (e.g., `OffscreenPanel`).
