# components/files/ScenarioSelector.tsx

The main menu / landing page for starting or loading games.

**Layer:** Components — Files

---

## Component

### `ScenarioSelector(): JSX.Element`
- **Line:** 9
- **Description:** Full-screen component with two tabs: "New Game" and "Load Game". Displays built-in and custom scenarios for new games, and a list of saved games for loading. Supports importing, exporting, and deleting custom scenarios.

---

## Functions

### `loadCustomScenarios(): Promise<void>`
- **Line:** 25
- **Description:** Fetches custom scenarios from `storage?key=custom_scenarios`. Populates the `customScenarios` state array.

---

### `saveCustomScenarios(scenarios: ScenarioConfig[]): Promise<void>`
- **Line:** 37
- **Description:** Persists the custom scenarios array to the storage API under the `custom_scenarios` key.

---

### `loadSavedGames(): Promise<void>`
- **Line:** 56
- **Description:** Fetches the list of all save files, filters for world storage files, and sorts by last modified date (newest first).

---

### `handleStartScenario(scenario: ScenarioConfig): void`
- **Line:** 73
- **Description:** Creates a new save slot with a timestamp-based ID, sets it as the active save in `localStorage`, and calls `initializeScenario()`.

---

### `handleImportScenario(scenario: ScenarioConfig): void`
- **Line:** 96
- **Description:** Appends the imported scenario to the custom scenarios list and persists.

---

### `handleDeleteScenario(indexToDelete: number): void`
- **Line:** 105
- **Description:** Removes a custom scenario by index (with confirmation) and persists.

---

### `handleExportScenario(scenario: ScenarioConfig): void`
- **Line:** 112
- **Description:** Downloads the scenario as a JSON file. Creates a temporary `<a>` element with a data URI and triggers a click.

---

### `handleLoadGame(id: string): void`
- **Line:** 122
- **Description:** Sets the selected save ID as the active key in `localStorage` and reloads the page (with confirmation).

---

### `getDisplayName(id: string): string`
- **Line:** 131
- **Description:** Converts a save ID to a human-readable name. `'surat-world-storage'` → `'Default'`; otherwise strips the prefix and replaces hyphens with spaces.
