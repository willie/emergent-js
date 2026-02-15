# app/api/simulate/route.ts

Off-screen character simulation endpoint.

**Layer:** API Route (Server)

---

## Functions

### `POST(req: Request): Promise<Response>`
- **Line:** 4
- **Description:** Parses `{ worldState, playerLocationClusterId, timeSinceLastSimulation, modelId }` from the request body. Extracts the 15 most recent events (sorted chronologically) as context, then delegates to `simulateOffscreen()`.
- **Returns:** JSON containing `{ events, conversations, characterUpdates }`.
