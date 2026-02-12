## 2024-05-22 - Icon-only buttons accessibility
**Learning:** Icon-only buttons (like Edit/Delete actions) are a common pattern here but consistently lack accessible names, making them invisible to screen reader users.
**Action:** Automatically flag any button containing only an SVG for review to ensure it has an `aria-label`.
