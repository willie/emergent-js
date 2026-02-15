# components/files/ScenarioImportDialog.tsx

Modal dialog for importing scenario JSON files.

**Layer:** Components — Files

---

## Component

### `ScenarioImportDialog({ isOpen, onClose, onImport }): JSX.Element | null`
- **Line:** 12
- **Description:** Renders a modal with a file upload area. Reads the selected `.json` file, validates it against `ScenarioSchema` using Zod's `safeParse`, and calls `onImport` on success. Displays validation errors on failure.

---

## Event Handlers

### `handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void`
- **Line:** 18
- **Description:** FileReader-based handler that parses the uploaded file as JSON, validates with Zod, and either imports or displays an error.
