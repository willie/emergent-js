# lib/ai/models.ts

User-selectable model list.

**Layer:** Library — AI & Models

---

## Exports

### `AVAILABLE_MODELS`
- **Line:** 2
- **Description:** A readonly tuple of model ID strings available for user selection in the settings dialog.

---

### `AvailableModel`
- **Line:** 10
- **Description:** Type alias derived from `typeof AVAILABLE_MODELS[number]`. Represents the union of valid model ID strings.

---

### `DEFAULT_MODEL`
- **Line:** 12
- **Description:** The first entry in `AVAILABLE_MODELS`, used as the initial value for `SettingsStore.modelId`.

---

### `isValidModel(modelId: string): modelId is AvailableModel`
- **Line:** 14
- **Description:** Type guard that returns `true` if the given string is one of the `AVAILABLE_MODELS`. Used by all three API routes to validate the `modelId` from request bodies.
