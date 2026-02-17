## 2025-02-26 - Duplicated Loading Indicators and Missing Accessibility

**Learning:** I found that loading spinners were implemented as duplicated SVG code in multiple places, lacking accessibility attributes like `aria-hidden`. Additionally, icon-only buttons (or buttons that become icon-only when loading) often rely on visual cues without accessible text fallbacks.
**Action:** Always extract decorative SVGs like spinners into reusable components with `aria-hidden="true"`. Ensure buttons that change content (e.g., text to spinner) maintain an accessible label via `aria-label`.
