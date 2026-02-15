# app/api/storage/route.ts

File-backed JSON key-value storage endpoint.

**Layer:** API Route (Server)

---

## Functions

### `GET(req: Request): Promise<Response>`
- **Line:** 15
- **Description:** Two modes:
  - `?list=true` — Lists all `.json` files in the `data/` directory. Returns `{ id, updatedAt }[]`.
  - `?key=<name>` — Reads and returns the JSON contents of `data/<sanitized-key>.json`. Returns `null` if the file doesn't exist.

---

### `POST(req: Request): Promise<Response>`
- **Line:** 58
- **Description:** Writes a JSON value to disk. Parses `{ key, value }` from the request body. Sanitizes the key (strips non-alphanumeric characters except `-` and `_`) and writes to `data/<key>.json`.

---

### `DELETE(req: Request): Promise<Response>`
- **Line:** 79
- **Description:** Deletes the file at `data/<sanitized-key>.json`. Returns success or error.

---

### `ensureDataDir(): Promise<void>`
- **Line:** 7
- **Description:** Creates the `data/` directory if it doesn't exist. Called before every read/write/list operation.
