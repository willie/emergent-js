# components/world/GameLayout.tsx

The main game layout orchestrating all panels.

**Layer:** Components — World

---

## Component

### `GameLayout(): JSX.Element`
- **Line:** 17
- **Description:** Top-level layout component. If no world is loaded (`world === null`), renders the `ScenarioSelector`. Otherwise, renders: the header with `LocationHeader` and `WorldClock`, the main `MainChatPanel`, a sidebar with tabs for `OffscreenPanelContainer` and `CharacterPanel`, mobile bottom navigation, and dialog overlays for settings and saves.

---

## Event Handlers

### `handleMobileNav(view: 'chat' | 'locations' | 'people'): void`
- **Line:** 33
- **Description:** Switches between mobile views: `'chat'` shows the chat panel; `'locations'` shows the sidebar with the Elsewhere tab; `'people'` shows the sidebar with the Characters tab.
