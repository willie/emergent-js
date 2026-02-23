# Palette's Journal

This journal documents critical UX and accessibility learnings.

## Format
`## YYYY-MM-DD - [Title]`
`**Learning:** [UX/a11y insight]`
`**Action:** [How to apply next time]`

## 2024-05-22 - Accessible Loading States
**Learning:** Buttons that replace text with loading spinners lose their accessible name if not explicitly handled.
**Action:** When implementing loading states, always ensure the button retains an `aria-label` describing the action (e.g., "Sending...") and mark the spinner as `aria-hidden="true"`.
