# components/settings/SettingsDialog.tsx

Model selection dialog.

**Layer:** Components — Settings

---

## Component

### `SettingsDialog({ isOpen, onClose }): JSX.Element | null`
- **Line:** 11
- **Description:** Modal dialog displaying radio buttons for each model in `AVAILABLE_MODELS`. Reads and writes `modelId` via `useSettingsStore`.
