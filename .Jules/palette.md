## 2024-03-03 - Accessible Dropzones
**Learning:** Interactive non-button elements (e.g., clickable divs for file dropzones) must include `role="button"`, `tabIndex={0}`, and an `onKeyDown` handler that prevents default and triggers on Enter and Space keys to ensure full keyboard accessibility.
**Action:** Always add keyboard event handlers to custom file inputs and dropzones to maintain tab accessibility and trigger behavior.
