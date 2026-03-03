# lib/chat/tool-processor.ts

Pure utility functions for character name matching. Tool execution and world mutations are now handled server-side in the chat route and applied client-side via state deltas.

**Layer:** Library — Chat Processing

---

## Functions

### `normalizeName(name: string): string`
- **Line:** 6
- **Description:** Normalizes a character name for fuzzy matching by lowercasing and removing non-word characters.

---

### `findBestCharacterMatch(searchName: string, characters: Character[]): { id: string; name: string } | null`
- **Line:** 16
- **Description:** Finds the best matching character using progressive strategies:
  1. Exact case-insensitive match.
  2. Normalized exact match.
  3. Substring match (either name contains search or search contains name).
- **Returns:** The matched character's `{ id, name }` or `null`.
