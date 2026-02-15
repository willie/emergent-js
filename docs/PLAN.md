# Refactor Plan: Clean API / UI Separation

## Problem

`MainChatPanel.tsx` (~685 lines) is a god component mixing business logic with UI. The action pipeline is split: server detects actions, client executes them. `tool-processor.ts` runs client-side but orchestrates server calls and mutates world state. History repair logic (~130 lines) is embedded in a component useEffect.

## Phases

Execute in this order for minimum disruption. Phases 1 and 3 are independent and can be done in parallel.

---

### Phase 1: Extract Game Engine Module

Move all game logic out of `MainChatPanel.tsx` into a plain TypeScript module with no React dependencies.

**Step 1.1 — Create `lib/game/types.ts`**
- Extract type guards (`isTextPart`, `isToolResultPart`, `isDynamicToolPart`, `isToolResult`) from `MainChatPanel.tsx` lines 23–76
- Extract local interfaces (`TextPart`, `ToolInvocation`, `MessageWithToolInvocations`, `ToolResultPart`, `DynamicToolPart`)
- These are used by both the engine and the component

**Step 1.2 — Create `lib/game/engine.ts`**
- Export `createGameEngine(config: GameEngineConfig)` — a factory that takes store actions as dependencies (no React, no Zustand imports)
- Move `handleProcessToolResult` logic (lines 142–167) into `engine.processToolResult()`
- Move regeneration rollback logic (lines 318–392) into `engine.prepareRegeneration(lastAssistant)` — clears processed tools, removes created characters/events, calculates and reverts time cost
- Move tool result scanning useEffect body (lines 395–426) into `engine.scanAndProcessToolResults(messages)`

```typescript
export interface GameEngineConfig {
  worldActions: WorldActions;
  getModelId: () => string;
  processedTools: Set<string>;
  onToolProcessed: (key: string) => void;
  lastSimulationTick: { current: number };
}
```

**Step 1.3 — Create `lib/hooks/use-game-engine.ts`**
- Thin React hook that reads store actions from `useWorldStore`, `modelId` from `useSettingsStore`, persistence state from `useChatPersistence`
- Instantiates the game engine via `createGameEngine(...)` with stable references
- Returns the engine instance — this is the only React-to-engine bridge

**Step 1.4 — Simplify `MainChatPanel.tsx`**
- Remove ~250 lines: type guards, `handleProcessToolResult`, regeneration logic, tool scanning useEffect, ~18 individual store selectors
- Import type guards from `lib/game/types.ts`
- Use `useGameEngine()` hook; delegate to engine methods
- Component keeps only: rendering JSX, `useChat` integration, input state, message editing, auto-scroll

**Files:**
- New: `lib/game/engine.ts`, `lib/game/types.ts`, `lib/hooks/use-game-engine.ts`
- Modified: `components/chat/MainChatPanel.tsx`

---

### Phase 2: Move Action Execution Server-Side

Eliminate client-side orchestration of location resolution and simulation. The chat route becomes the single authority for game logic.

**Step 2.1 — Create `lib/game/action-executor.ts` (server-only)**
- Imports `resolveLocation` from `lib/world/locations.ts` and `simulateOffscreen` from `lib/world/simulation.ts` directly (no HTTP calls)
- Export `executeActions(toolCalls, worldState, lastSimulationTick, modelId) → { actions: ActionResult[], newLastSimulationTick }`
- For `moveToLocation`: resolves location, determines if simulation should trigger, runs simulation if so
- For `advanceTime`: computes time cost
- For `discoverCharacter`: finds by fuzzy match or describes new character

```typescript
export interface ActionResult {
  type: 'movement' | 'time_advance' | 'character_discovery';
  newCluster?: { canonicalName: string; isNew: boolean };
  playerMovedTo?: string;
  accompaniedMoves?: { characterId: string; clusterId: string }[];
  timeCost?: number;
  narrativeTime?: string;
  simulation?: { events: WorldEvent[]; conversations: Omit<Conversation, 'id'>[]; characterUpdates: { characterId: string; newLocationId: string }[] };
  discoveredCharacterId?: string;
  newCharacter?: Omit<Character, 'id'>;
}
```

**Step 2.2 — Modify `app/api/chat/route.ts`**
- After `analyzePlayerIntent` returns tool calls, call `executeActions(...)` server-side
- Use the Vercel AI SDK's `createDataStream` to send `ActionResult[]` as a structured data part before the narrative text stream
- Add `lastSimulationTick` to request body: `{ messages, worldState, modelId, lastSimulationTick }`
- The narrative stage can now incorporate action results into the system prompt

**Step 2.3 — Simplify `lib/chat/tool-processor.ts` to an applicator**
- Remove: `resolveLocationViaApi`, `runSimulationViaApi` (HTTP fetch wrappers)
- Keep: `normalizeName`, `findBestCharacterMatch` (utilities)
- Add: `applyActionResults(results: ActionResult[], worldActions: WorldActions, messageId: string)` — pure function that takes the server's results and calls store actions

**Step 2.4 — Update game engine**
- Handle the new data stream format: listen for `action_results` data event, call `applyActionResults`
- Update `lastSimulationTick` from the server response

**Step 2.5 — Delete proxy routes**
- Remove `app/api/locations/resolve/route.ts`
- Remove `app/api/simulate/route.ts`
- The underlying library functions (`lib/world/locations.ts`, `lib/world/simulation.ts`) remain unchanged

**Files:**
- New: `lib/game/action-executor.ts`
- Modified: `app/api/chat/route.ts`, `lib/chat/tool-processor.ts`, `lib/game/engine.ts`, `components/chat/MainChatPanel.tsx`
- Deleted: `app/api/locations/resolve/route.ts`, `app/api/simulate/route.ts`

---

### Phase 3: Extract History Repair Hook

Move the ~130-line healing useEffect out of `MainChatPanel.tsx` into a dedicated hook.

**Step 3.1 — Create `lib/hooks/use-history-repair.ts`**
- Direct lift-and-shift of lines 176–316 from `MainChatPanel.tsx`
- The `hasRepairedHistory` ref moves into the hook
- No behavioral change

```typescript
export function useHistoryRepair(options: {
  messages: UIMessage[];
  world: WorldState | null;
  isHydrated: boolean;
  processedTools: React.MutableRefObject<Set<string>>;
  markToolProcessed: (key: string) => void;
  deduplicateEvents: () => void;
  deduplicateConversations: () => void;
}): void
```

**Step 3.2 — Update `MainChatPanel.tsx`**
- Replace the ~130-line useEffect + `hasRepairedHistory` ref with a single `useHistoryRepair({...})` call

**Files:**
- New: `lib/hooks/use-history-repair.ts`
- Modified: `components/chat/MainChatPanel.tsx`

---

### Phase 4: Tests

Add a test runner and write tests for each extracted piece.

**Step 4.1 — Install Vitest**
```
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
```
Add `vitest.config.ts` and `"test": "vitest run"` script.

**Step 4.2 — Test plan**

| Module | Test file | What to test |
|--------|-----------|--------------|
| `lib/game/engine.ts` | `lib/game/__tests__/engine.test.ts` | Process each tool result type; regeneration rollback calculates correct time cost; tool scanning finds results in message parts |
| `lib/game/action-executor.ts` | `lib/game/__tests__/action-executor.test.ts` | Movement resolves location and triggers simulation when threshold exceeded; skips simulation within threshold; discovers existing/new characters |
| `lib/hooks/use-history-repair.ts` | `lib/hooks/__tests__/use-history-repair.test.ts` | Heals processed tools when set is empty; deduplicates events/conversations; runs only once |
| `lib/chat/tool-processor.ts` | `lib/chat/__tests__/tool-processor.test.ts` | `applyActionResults` creates clusters, moves player, applies simulation results |

---

## Implementation Order

1. **Phase 1** + **Phase 3** (in parallel) — purely additive, no behavior change
2. **Phase 4 (partial)** — tests for Phase 1 & 3 as a safety net
3. **Phase 2** — the complex change (modifies API contract)
4. **Phase 4 (complete)** — tests for Phase 2

## Risks

| Risk | Mitigation |
|------|------------|
| Phase 2 changes the streaming protocol | Use Vercel AI SDK `createDataStream` which supports data annotations + text in one response; `useChat` supports `onData` callbacks |
| Server needs `lastSimulationTick` (currently client-only) | Add to request body in Phase 2.2 |
| Stale world state on server | Server returns declarative mutation instructions (`ActionResult[]`), not absolute state; client applies deltas idempotently |
| Breaking tool call display in message history | After executing server-side, still include tool result annotations in stream metadata so message parts reflect what happened |

## Final File Structure

```
lib/
  game/
    engine.ts              # NEW — Pure TS game engine
    action-executor.ts     # NEW — Server-side action execution
    types.ts               # NEW — Shared type guards and interfaces
    __tests__/
  chat/
    action-analyzer.ts     # UNCHANGED
    tool-processor.ts      # SIMPLIFIED — Orchestrator → applicator
    __tests__/
  hooks/
    use-chat-persistence.ts  # UNCHANGED
    use-game-engine.ts       # NEW — React bridge to engine
    use-history-repair.ts    # NEW — Extracted from MainChatPanel
    __tests__/
  world/
    locations.ts           # UNCHANGED
    simulation.ts          # UNCHANGED

app/api/
  chat/route.ts            # MODIFIED — Executes actions server-side

components/chat/
  MainChatPanel.tsx        # SIMPLIFIED — ~250 lines removed
  MessageActions.tsx       # UNCHANGED
```

Deleted:
- `app/api/locations/resolve/route.ts` (absorbed into `action-executor.ts`)
- `app/api/simulate/route.ts` (absorbed into `action-executor.ts`)
