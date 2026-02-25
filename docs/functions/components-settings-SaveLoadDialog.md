# components/settings/SaveLoadDialog.tsx

Save game management dialog.

**Layer:** Components — Settings

---

## Component

### `SaveLoadDialog({ isOpen, onClose }): JSX.Element | null`
- **Line:** 16
- **Description:** Modal dialog for managing save games. Lists all world storage saves with the active one highlighted. Supports creating new saves, loading existing saves (via page reload), and deleting saves (including associated chat and tool data).

---

## Functions

### `loadSaves(): Promise<void>`
- **Line:** 35
- **Description:** Fetches save files from the storage API, filters for world storage files, and sorts by date.

---

### `handleCreateSave(): void`
- **Line:** 54
- **Description:** Creates a new save slot from the user-entered name. Slugifies the name, checks for duplicates, sets the active key, and reloads the page.

---

### `handleLoad(id: string): void`
- **Line:** 78
- **Description:** Switches to the selected save slot by setting the active key and reloading (with confirmation).

---

### `handleDelete(id: string, e: React.MouseEvent): Promise<void>`
- **Line:** 86
- **Description:** Deletes a save and its associated chat/tool storage files (with confirmation). If the deleted save was active, switches to the default slot and reloads.

---

### `getDisplayName(id: string): string`
- **Line:** 110
- **Description:** Converts a save ID to a display name (same logic as in `ScenarioSelector`).
