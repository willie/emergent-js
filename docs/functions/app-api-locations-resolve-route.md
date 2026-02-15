# app/api/locations/resolve/route.ts

Location resolution endpoint.

**Layer:** API Route (Server)

---

## Functions

### `POST(req: Request): Promise<Response>`
- **Line:** 4
- **Description:** Parses `{ description, existingClusters, modelId }` from the request body. Delegates to `resolveLocation()` to semantically match the description against existing location clusters.
- **Returns:** JSON containing `{ clusterId, canonicalName, isNew }`.
