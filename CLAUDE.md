# CLAUDE.md

Interactive narrative engine. Next.js 16 + React 19 + Zustand + AI SDK v6.

## Architecture

Server-side tool execution in a single request: `/api/chat` runs intent analysis → tool execution → narration. State deltas are attached to assistant messages via AI SDK `messageMetadata` (`GameMessage.metadata.stateDelta`). The client applies deltas from message metadata; simulation runs separately after movement.

World state is client-owned (sent per request); the server is stateless. The API client SDK at `lib/api/client.ts` centralizes all fetch calls (storage, simulate).

## Key types

- `StateDelta` / `GameMessage` / `GameMessageMetadata` — `lib/chat/types.ts`
- `WorldState` — `types/world.ts`
- `SimpleToolCall` — `lib/chat/action-analyzer.ts`

## Key files

- `app/api/chat/route.ts` — single-request pipeline: `analyzePlayerIntent` → `executeTools` → `streamText` with delta metadata
- `components/chat/MainChatPanel.tsx` — applies deltas via `appliedDeltas` ref, triggers simulation via `api.simulate`
- `lib/hooks/use-chat-persistence.ts` — generic over UIMessage subtype, messages only (no tool tracking)
- `lib/chat/tool-processor.ts` — pure functions only: `findBestCharacterMatch`, `normalizeName`
- `lib/api/client.ts` — centralized API client (storage CRUD, simulate)

## Design

Narrative emerges from simulation, immersion, and agency — not from authored plot. See `docs/` for longer design notes.
