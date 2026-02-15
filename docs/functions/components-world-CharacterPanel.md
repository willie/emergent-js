# components/world/CharacterPanel.tsx

Displays discovered characters with expandable details and inline editing.

**Layer:** Components — World

---

## Component

### `CharacterPanel(): JSX.Element`
- **Line:** 6
- **Description:** Lists all discovered non-player characters with their current location. Each entry is expandable to show the character's description and last 5 knowledge entries. Supports inline editing of character name and description via `updateCharacter`.

---

## Event Handlers

### `startEditing(char: Character, e: React.MouseEvent): void`
- **Line:** 15
- **Description:** Enters edit mode for a character — sets the editing ID and populates the edit form.

---

### `saveEdit(charId: string, e: React.MouseEvent): void`
- **Line:** 22
- **Description:** Saves the edit form values to the character via `updateCharacter` and exits edit mode.

---

### `cancelEdit(e: React.MouseEvent): void`
- **Line:** 28
- **Description:** Exits edit mode without saving.
