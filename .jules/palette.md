## 2026-02-20 - Dynamic Loading State Labels
**Learning:** When buttons switch from text to an icon-only loading spinner, screen readers lose context if the button doesn't have an `aria-label`.
**Action:** Always add a dynamic `aria-label` (e.g., "Sending...") when the button is in a loading state and hide the spinner SVG with `aria-hidden="true"`.
