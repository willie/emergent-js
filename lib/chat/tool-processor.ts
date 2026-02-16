import type { Character } from '@/types/world';

/**
 * Normalizes a name for fuzzy matching by lowercasing and removing non-word characters.
 */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^\w\s]/g, '').trim();
}

/**
 * Finds the best matching character by name using progressive matching strategies:
 * 1. Exact match (case insensitive)
 * 2. Normalized exact match
 * 3. Substring match
 */
export function findBestCharacterMatch(
  searchName: string,
  characters: Character[]
): { id: string; name: string } | null {
  const normalizedSearch = normalizeName(searchName);

  // 1. Exact match (case insensitive)
  const exact = characters.find(c =>
    c.name.toLowerCase() === searchName.toLowerCase()
  );
  if (exact) return exact;

  // 2. Normalized exact match
  const normalizedExact = characters.find(c =>
    normalizeName(c.name) === normalizedSearch
  );
  if (normalizedExact) return normalizedExact;

  // 3. Substring match (name contains search or search contains name)
  const bestPartial = characters.find(c => {
    const normChar = normalizeName(c.name);
    return normChar.includes(normalizedSearch) || normalizedSearch.includes(normChar);
  });

  return bestPartial || null;
}
