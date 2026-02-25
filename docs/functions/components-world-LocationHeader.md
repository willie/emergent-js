# components/world/LocationHeader.tsx

Displays the player's current location and present characters.

**Layer:** Components — World

---

## Component

### `LocationHeader({ topRight, bottomRight }): JSX.Element | null`
- **Line:** 5
- **Description:** Header component that queries the world store for the player character, their current location cluster, and nearby discovered NPCs. Renders the location name and a list of present character names. Accepts `topRight` and `bottomRight` React node slots for additional content (used for `WorldClock` and settings buttons).
