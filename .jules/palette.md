# Palette's Journal

## 2026-02-16 - Accessible Loading States
**Learning:** Chat buttons (Send/Continue) replace text with a spinner during loading, removing their accessible name.
**Action:** Always add a dynamic `aria-label` (e.g., "Sending...") to buttons that replace text with icons during loading states.
