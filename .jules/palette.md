
## 2024-05-18 - File Dropzone Keyboard Accessibility
**Learning:** When using a non-semantic HTML element like `<div>` as a file upload trigger via an `onClick` handler, the element becomes invisible to keyboard navigation and screen readers.
**Action:** When implementing clickable areas for file uploads or complex custom actions, always ensure to use `role="button"`, `tabIndex={0}`, an `onKeyDown` handler to capture Enter/Space keys (preventing default behavior on Space), and `focus-visible` styling to make the element fully accessible for keyboard users.
