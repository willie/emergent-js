# lib/world/locations.ts

Location resolution and semantic matching.

**Layer:** Library — World Simulation

---

## Functions

### `resolveLocation(description: string, existingClusters: LocationCluster[], modelId?: string): Promise<{ clusterId, canonicalName, isNew }>`
- **Line:** 10
- **Description:** Resolves a location description to an existing cluster or determines it's new. If no clusters exist, extracts a canonical name directly. Otherwise, sends the description and cluster list to an LLM with a `resolveLocation` tool (Zod-validated schema). If the LLM's match confidence is >= 0.6, returns the matched cluster. Otherwise, returns `isNew: true` with an extracted canonical name.

---

### `extractCanonicalName(description: string): string`
- **Line:** 93
- **Description:** Extracts a short canonical location name from a free-text description. Strips leading articles ("the", "a", "to", etc.) and trailing generic words ("area", "place", "room", etc.). Title-cases the first 4 words.
- **Example:** `"the old coffee shop building"` → `"Old Coffee Shop"`.
