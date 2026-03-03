# lib/storage/keys.ts

Centralized storage key constants and save slot management.

**Layer:** Library — Storage

---

## Exports

### `STORAGE_KEYS`
- **Line:** 6
- **Description:** Constant object containing all storage key base strings: `MESSAGES`, `WORLD`, `ACTIVE_SAVE`.

---

## Functions

### `getStorageKey(base: string): string`
- **Line:** 16
- **Description:** Returns a storage key with the active save slot suffix appended. Reads `active_save_key` from `localStorage`, extracts the slot identifier, and appends it to the base key. Returns the base key unchanged if no active slot or using the default slot.
- **Example:** With `active_save_key = 'surat-world-storage-slot1'`, calling `getStorageKey('surat-chat-messages')` returns `'surat-chat-messages-slot1'`.

---

### `getActiveSaveSlot(): string | null`
- **Line:** 31
- **Description:** Returns the currently active save slot key from `localStorage`, or `null` if using the default slot.

---

### `setActiveSaveSlot(slot: string): void`
- **Line:** 41
- **Description:** Sets the active save slot in `localStorage`.

---

### `clearActiveSaveSlot(): void`
- **Line:** 49
- **Description:** Resets to the default save slot by setting `active_save_key` to the default world storage key.

---

### `getSaveDisplayName(id: string): string`
- **Line:** 57
- **Description:** Returns a human-readable display name for a save slot ID. `'surat-world-storage'` → `'Default'`; otherwise strips the prefix and replaces hyphens with spaces.
