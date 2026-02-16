/**
 * Centralized storage key management for the application.
 * All storage keys should be defined here to prevent duplication and ensure consistency.
 */

export const STORAGE_KEYS = {
  MESSAGES: 'surat-chat-messages',
  WORLD: 'surat-world-storage',
  ACTIVE_SAVE: 'active_save_key',
} as const;

/**
 * Returns the storage key with the active save slot suffix appended if one is set.
 * This allows multiple save slots to use separate storage namespaces.
 */
export function getStorageKey(base: string): string {
  if (typeof window === 'undefined') return base;
  const activeKey = localStorage.getItem(STORAGE_KEYS.ACTIVE_SAVE);
  if (!activeKey || activeKey === STORAGE_KEYS.WORLD) return base;

  const match = activeKey.match(/^surat-world-storage-(.+)$/);
  if (match) {
    return `${base}-${match[1]}`;
  }
  return base;
}

/**
 * Returns the currently active save slot key, or null if using the default slot.
 */
export function getActiveSaveSlot(): string | null {
  if (typeof window === 'undefined') return null;
  const activeKey = localStorage.getItem(STORAGE_KEYS.ACTIVE_SAVE);
  if (!activeKey || activeKey === STORAGE_KEYS.WORLD) return null;
  return activeKey;
}

/**
 * Sets the active save slot. Pass the full storage key (e.g., 'surat-world-storage-slot1').
 */
export function setActiveSaveSlot(slot: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ACTIVE_SAVE, slot);
}

/**
 * Resets to the default save slot.
 */
export function clearActiveSaveSlot(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ACTIVE_SAVE, STORAGE_KEYS.WORLD);
}
