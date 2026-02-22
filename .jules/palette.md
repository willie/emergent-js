# Palette's Journal

## 2025-02-18 - Accessibility Improvements in Chat
**Learning:** Icon-only buttons with tooltips are great, but explicitly hiding SVGs (`aria-hidden="true"`) and providing robust `aria-label`s for loading states ensures screen reader users aren't left guessing.
**Action:** When implementing icon-only buttons or loading states, always verify screen reader output by simulating the state and checking the accessible name.
