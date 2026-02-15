# store/settings-store.ts

User preferences store.

**Layer:** State Management

---

## Store

### `useSettingsStore`
- **Line:** 10
- **Description:** Zustand store with a single `modelId` field and a `setModelId` action. Persisted to `localStorage` under key `'surat-settings'`.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `modelId` | `string` | The currently selected LLM model ID. Defaults to `DEFAULT_MODEL`. |

### Actions

| Action | Description |
|--------|-------------|
| `setModelId(id: string)` | Updates the selected model ID. |
