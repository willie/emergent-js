# Prompt Construction Reference

How the final LLM prompts are assembled in emergent-js, traced from raw inputs to API calls.

The system uses a **dual-prompt architecture**: a fast Logic Analysis pass detects game actions, then a high-quality Narration pass generates the response. A separate Simulation pipeline handles off-screen character interactions. A Location Resolution prompt handles semantic location matching.

---

## Table of Contents

1. [Overview: Request Lifecycle](#1-overview-request-lifecycle)
2. [Prompt 1: Logic Analysis (Intent Detection)](#2-prompt-1-logic-analysis-intent-detection)
3. [Prompt 2: Narration (Main Response)](#3-prompt-2-narration-main-response)
4. [Prompt 3: Off-Screen Simulation — Full Dialogue](#4-prompt-3-off-screen-simulation--full-dialogue)
5. [Prompt 4: Off-Screen Simulation — Event Extraction](#5-prompt-4-off-screen-simulation--event-extraction)
6. [Prompt 5: Off-Screen Simulation — Summary](#6-prompt-5-off-screen-simulation--summary)
7. [Prompt 6: Location Resolution](#7-prompt-6-location-resolution)
8. [Chat History Handling](#8-chat-history-handling)
9. [World State as Context](#9-world-state-as-context)
10. [Model Routing](#10-model-routing)
11. [User Input Preprocessing](#11-user-input-preprocessing)
12. [What This System Does NOT Have](#12-what-this-system-does-not-have)
13. [Final Prompt Layout Diagrams](#13-final-prompt-layout-diagrams)

---

## 1. Overview: Request Lifecycle

**Entry point:** `app/api/chat/route.ts:20` — `POST` handler

The client (`components/chat/MainChatPanel.tsx:46-54`) sends:

```typescript
// MainChatPanel.tsx:47-53
transport: new DefaultChatTransport({
  api: "/api/chat",
  body: {
    worldState: world,        // Full WorldState from Zustand store
    modelId,                  // User-selected model override
    lastSimulationTick: lastSimulationTick.current,
  },
}),
```

The server receives this and runs a three-phase pipeline:

```
Phase 1: analyzePlayerIntent()     → detect game actions (fast model)
Phase 2: executeTools()            → resolve locations, match characters, build StateDelta
Phase 3: streamText()              → narrate using buildSystemPrompt() (high-quality model)
```

**Defined at:** `app/api/chat/route.ts:20-106`

**Serverless timeout:** `maxDuration = 30` (seconds) at `app/api/chat/route.ts:18` — Next.js route segment config constraining the entire pipeline (all three phases).

---

## 2. Prompt 1: Logic Analysis (Intent Detection)

**Purpose:** Determine if the player's latest message implies a game state change (movement, time passage, character discovery). Does NOT generate narrative text.

**File:** `lib/chat/action-analyzer.ts:73-141`
**Function:** `analyzePlayerIntent(messages, worldState, modelId)`
**Model:** `models.fast` (`openai/gpt-4o-mini`) — hardcoded at `lib/ai/openrouter.ts:14`
**API client:** Direct OpenAI SDK pointing at OpenRouter (`lib/chat/action-analyzer.ts:6-9`)

### System Prompt (verbatim template)

```typescript
// lib/chat/action-analyzer.ts:81-95
const systemPrompt = `You are the Game Logic Engine.
Your ONLY job is to analyze the user's latest input and determine if any GAME ACTIONS need to happen.
DO NOT write a narrative response. ONLY call tools if the user tries to do something that changes the state.

Current State:
- Location: ${playerLocation?.canonicalName ?? 'Unknown'}
- Time: ${worldState.time.narrativeTime}
- Characters Here: ${worldState.characters.filter(c => c.currentLocationClusterId === player?.currentLocationClusterId && c.isDiscovered && !c.isPlayer).map(c => c.name).join(', ') || 'None'}

Tools Available:
- moveToLocation: User implies movement.
- advanceTime: User implies waiting.
- discoverCharacter: User notices someone new.

If the user is just talking, call NO tools.`;
```

### Dynamic Variables Injected

| Variable | Source | How |
|----------|--------|-----|
| `playerLocation?.canonicalName` | `worldState.locationClusters` filtered by player's `currentLocationClusterId` | `action-analyzer.ts:79` |
| `worldState.time.narrativeTime` | `worldState.time` object | Direct interpolation |
| Characters list | `worldState.characters` filtered: same location as player, `isDiscovered`, not `isPlayer` | `action-analyzer.ts:88` |

### Tool Definitions

Three tools defined as raw OpenAI function-calling JSON schemas:

```typescript
// lib/chat/action-analyzer.ts:12-60
export const GAME_TOOLS_CUSTOM_SCHEMA: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'moveToLocation',
            description: 'Call this when the player moves to a different location...',
            parameters: {
                type: 'object',
                properties: {
                    destination: { type: 'string', description: 'Brief description of where they are going' },
                    narrativeTime: { type: 'string', description: 'New narrative time description...' },
                    accompaniedBy: { type: 'array', items: { type: 'string' }, description: 'List of other character names explicitly moving WITH the player.' }
                },
                required: ['destination', 'narrativeTime', 'accompaniedBy']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'advanceTime',
            description: 'Call this when significant time passes without movement...',
            parameters: {
                type: 'object',
                properties: {
                    narrativeTime: { type: 'string', description: 'New narrative time description' },
                    ticks: { type: 'number', description: 'How many time units pass. Default to 5.' }
                },
                required: ['narrativeTime', 'ticks']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'discoverCharacter',
            description: 'Call this when the player encounters or notices a new character...',
            parameters: {
                type: 'object',
                properties: {
                    characterName: { type: 'string', description: 'Name of the character being discovered' },
                    introduction: { type: 'string', description: 'How they are introduced or noticed' },
                    goals: { type: 'string', description: 'Inferred or stated goals...' }
                },
                required: ['characterName', 'introduction', 'goals']
            }
        }
    }
];
```

### Final API Call Structure

```typescript
// lib/chat/action-analyzer.ts:110-118
const completion = await openai.chat.completions.create({
    model: models.fast,                              // "openai/gpt-4o-mini"
    messages: [
        { role: 'system', content: systemPrompt },   // System prompt above
        ...openAiMessages                             // Full chat history (role + content only)
    ],
    tools: GAME_TOOLS_CUSTOM_SCHEMA,                 // 3 tools above
    tool_choice: 'auto',                             // Model decides whether to call tools
});
```

### Message Conversion

Messages are converted from AI SDK format to simple `{ role, content }` pairs:

```typescript
// lib/chat/action-analyzer.ts:104-107
const openAiMessages: any[] = messages.map(m => ({
    role: m.role,
    content: m.content
}));
```

The input `messages` have already been converted via `convertToModelMessages(filteredMessages)` at the call site (`app/api/chat/route.ts:65`). This is the AI SDK's built-in conversion from `UIMessage[]` to model-compatible format.

### Prompt Order (as sent to model)

```
1. system: "You are the Game Logic Engine..."  (with current state variables)
2. user/assistant alternating: full filtered chat history
   (tool definitions provided via `tools` parameter, not in prompt body)
```

---

## 3. Prompt 2: Narration (Main Response)

**Purpose:** Generate the narrative response — describe locations, voice characters, react to state changes. This is the user-facing output.

**File:** `app/api/chat/route.ts:282-362`
**Function:** `buildSystemPrompt(world: WorldState): string`
**Model:** `models.mainConversation` (`z-ai/glm-4.6:exacto`) or user-selected model override
**API:** AI SDK v6 `streamText()` via OpenRouter provider (`app/api/chat/route.ts:95-101`)

### System Prompt (verbatim template)

```typescript
// app/api/chat/route.ts:330-361
return `You are the narrator and game master of an interactive narrative experience called "${world.scenario.title}".

SCENARIO: ${world.scenario.description}

CURRENT LOCATION: ${playerLocation?.canonicalName ?? "Unknown"}
OTHER KNOWN LOCATIONS: ${otherLocations || "None yet"}
TIME: ${world.time.narrativeTime} (tick ${world.time.tick})

CHARACTERS PRESENT (SYSTEM STATE):
${characterDescriptions || "(No one else is here)"}
(NOTE: If a character is participating in the conversation but is NOT listed above, they are not yet discovered. You MUST call discoverCharacter for them immediately.)
${undiscoveredHint}

${recentEvents ? `RECENT EVENTS:\n${recentEvents}\n` : ""}

YOUR ROLE:
- Narrate the world and characters in response to what the player does
- Play the characters present - give them distinct voices and personalities
- Characters should only know what they have witnessed or been told
- When the player moves to a new location, describe it vividly
- Include sensory details and atmosphere
- Keep responses focused and not overly long
- Characters can suggest actions but never force the player
- **IMPORTANT**: The System handles all game state changes (movement, discovery). You observe the state and narrate. If the user *just* moved (e.g. you see a 'movement' tool result), describe the new location.
- Do not hallucinate calling tools. You have no tools.

EXAMPLES:
User: "Who is in the kitchen with me?"
Assistant: [System Action Moves Player] "You walk into the kitchen. Standing there is..."

User: "I look around and see a mysterious woman named Sarah standing in the shadows."
Assistant: [System Action Discovers Sarah] "Sarah steps out of the shadows..."`;
```

### Dynamic Variables

Each variable is computed just before the template string:

#### Scenario Title & Description
```typescript
// Comes from: world.scenario.title, world.scenario.description
// Origin: ScenarioConfig defined in data/default-scenario.ts or data/scenarios/azure-lotus.ts
// Loaded into WorldState by: store/world-store.ts:127-130 (initializeScenario)
```

#### Current Location
```typescript
// app/api/chat/route.ts:284-286
const playerLocation = world.locationClusters.find(
  (c) => c.id === player?.currentLocationClusterId,
);
// Renders as: playerLocation?.canonicalName ?? "Unknown"
```

#### Other Known Locations
```typescript
// app/api/chat/route.ts:325-328
const otherLocations = world.locationClusters
  .filter((loc) => loc.id !== player?.currentLocationClusterId)
  .map((loc) => loc.canonicalName)
  .join(", ");
```

#### Time
```typescript
// Direct interpolation: world.time.narrativeTime and world.time.tick
// Example output: "Late afternoon (tick 12)"
```

#### Characters Present (discovered, same location, not player)
```typescript
// app/api/chat/route.ts:288-306
const presentCharacters = world.characters.filter(
  (c) =>
    !c.isPlayer &&
    c.isDiscovered &&
    c.currentLocationClusterId === player?.currentLocationClusterId,
);

const characterDescriptions = presentCharacters
  .map((c) => {
    const knowledgeStr =
      c.knowledge.length > 0
        ? `\n    Knows: ${c.knowledge
            .slice(-3)                    // Last 3 knowledge entries only
            .map((k) => k.content)
            .join("; ")}`
        : "";
    return `- ${c.name}: ${c.description}${knowledgeStr}`;
  })
  .join("\n");
```

Each character line looks like:
```
- Maya: A regular at the coffee shop. Friendly but secretive...
    Knows: The library has a secret basement; Alex mentioned something about a key; Marcus talks to birds
```

**Knowledge truncation:** Only the last 3 `KnowledgeEntry` objects per character are included (`.slice(-3)`). No token-level budgeting.

#### Undiscovered Characters (hints)
```typescript
// app/api/chat/route.ts:313-323
const undiscoveredHere = world.characters.filter(
  (c) =>
    !c.isPlayer &&
    !c.isDiscovered &&
    c.currentLocationClusterId === player?.currentLocationClusterId,
);

const undiscoveredHint =
  undiscoveredHere.length > 0
    ? `\nHIDDEN (can be discovered if player looks around or circumstances arise): ${undiscoveredHere.map((c) => c.name).join(", ")}`
    : "";
```

Only names are revealed — no descriptions or other details.

#### Recent Events
```typescript
// app/api/chat/route.ts:308-311
const recentEvents = world.events
  .slice(-5)                              // Last 5 events only
  .map((e) => `- ${e.description}`)
  .join("\n");
```

### Key Design Decision: The Narrator Has No Tools

```typescript
// app/api/chat/route.ts:99
tools: {},
```

The narrator receives an **empty tools object**. All game state changes happen in Phase 1 (Logic Analysis). The narrator only observes the post-action world state and describes it. The system prompt explicitly says: "Do not hallucinate calling tools. You have no tools."

### Effective World State

If Phase 1 detected actions, the world state is modified before building the narrator prompt:

```typescript
// app/api/chat/route.ts:83-84
effectiveWorldState = applyDeltaToWorldState(worldState, stateDelta);
```

`applyDeltaToWorldState` (`app/api/chat/route.ts:208-280`) creates an in-memory copy with:
- Time advanced by `delta.timeAdvance.ticks`
- Player moved to resolved location cluster
- Accompanied characters moved to same location
- Discovered characters marked as `isDiscovered: true`
- New location clusters added (with temporary IDs)

### Final API Call Structure

```typescript
// app/api/chat/route.ts:95-101
const result = streamText({
  model: openrouter(modelId || models.mainConversation),
  system: systemPrompt,                    // buildSystemPrompt output
  messages: await convertToModelMessages(filteredMessages),  // Full chat history
  tools: {},                               // No tools
  stopWhen: stepCountIs(5),                // Max 5 reasoning steps
});
```

### Response Delivery

```typescript
// app/api/chat/route.ts:103-105
return result.toUIMessageStreamResponse<GameMessage>({
  messageMetadata: stateDelta ? () => ({ stateDelta }) : undefined,
});
```

The `StateDelta` is attached as metadata on the streamed assistant message via AI SDK's `messageMetadata` mechanism. The client reads it from `message.metadata.stateDelta`.

### Prompt Order (as sent to model)

```
1. system: "You are the narrator and game master..."
   - Scenario title + description
   - Current location
   - Other known locations
   - Time (narrative + tick)
   - Characters present with descriptions + last 3 knowledge entries each
   - Note about undiscovered characters
   - Hidden character names (if any at current location)
   - Recent events (last 5)
   - Role instructions (7 behavioral rules)
   - 2 few-shot examples
2. user/assistant alternating: full filtered chat history
   (no tools provided)
```

---

## 4. Prompt 3: Off-Screen Simulation — Full Dialogue

**Purpose:** Generate dialogue between NPCs at locations the player is not present, simulating what happens "off-screen" while the player is elsewhere.

**File:** `lib/world/simulation.ts:73-228`
**Function:** `runFullSimulation(characters, locationName, timeElapsed, world, modelId, relevantEvents)`
**Model:** `models.mainConversation` (`z-ai/glm-4.6:exacto`) for dialogue generation
**Trigger:** Called from `simulateOffscreen()` when `determineSimulationDepth()` returns `'full'` (time since last interaction > 20 ticks, or unresolved plot points)

### System Prompt (verbatim template)

```typescript
// lib/world/simulation.ts:106-124
const systemPrompt = `You are simulating a conversation between ${characterNames} at ${locationName}.

Characters:
${characters.map(c => `- ${c.name}: ${c.description}${c.goals ? `\n  Goal: ${c.goals}` : ''}`).join('\n')}

${relationshipsText}

${historyText}

Scenario: ${world.scenario.description}
Time: ${world.time.narrativeTime}
Available Locations (for movement): ${availableLocations}

Write a natural dialogue between these characters. Each character should stay in character.
Format each line as: CHARACTER_NAME: "dialogue"
Include brief action descriptions in *asterisks* when appropriate.
If characters decide to go somewhere else, they should express it in dialogue.

Generate approximately ${turnCount} exchanges.`;
```

### Dynamic Variables

| Variable | Source | Computation |
|----------|--------|-------------|
| `characterNames` | `characters.map(c => c.name).join(' and ')` | `simulation.ts:86` |
| `locationName` | Resolved from `locationClusters` by ID | `simulation.ts:266` |
| Character list with goals | Each character's `name`, `description`, `goals` | `simulation.ts:109` |
| `relationshipsText` | Characters' `relationships[]` filtered to only inter-present relationships | `simulation.ts:94-100` |
| `historyText` | Recent events passed as `relevantEvents` param (last 15 events, `app/api/simulate/route.ts:19-22`) | `simulation.ts:102-104` |
| `availableLocations` | All `locationClusters[].canonicalName` joined | `simulation.ts:90-92` |
| `turnCount` | `Math.min(Math.ceil(timeElapsed / 2), 8)` — capped at 8 | `simulation.ts:87` |

### Relationships Text Format

```
- Maya's Relationships:
  * With Alex: Close friends who share secrets (Sentiment: 0.7)
```

Built at `simulation.ts:94-100`. Only relationships between characters present in this simulation group are included.

### History Text Format

```
SHARED HISTORY (Recent events they know about):
- [12] Maya found a strange symbol in her book
- [15] Alex whispered something to Maya about the basement
```

Or `SHARED HISTORY: None recently.` if no relevant events.

### Final API Call

```typescript
// lib/world/simulation.ts:126-129
const { text } = await generateText({
  model: openrouter(modelId || models.mainConversation),
  prompt: systemPrompt,     // Note: uses `prompt` not `system` — single-turn generation
});
```

This is a **single-turn completion** (no `system` + `messages` split). The entire prompt goes in as `prompt`.

### Prompt Order

```
1. prompt (single string):
   - Role: "You are simulating a conversation between..."
   - Character list with descriptions and goals
   - Relationship data between present characters
   - Shared history (recent events)
   - Scenario description
   - Current time
   - Available locations
   - Formatting instructions
   - Turn count instruction
```

---

## 5. Prompt 4: Off-Screen Simulation — Event Extraction

**Purpose:** Analyze the generated dialogue and extract structured data: significant events and character movements.

**File:** `lib/world/simulation.ts:155-178`
**Model:** `models.fast` (`openai/gpt-4o-mini`)
**Input:** The raw text output from Prompt 3

### Tool Definition

```typescript
// lib/world/simulation.ts:157-170
tools: {
  reportSimulation: tool({
    description: 'Report events and movements from the conversation',
    inputSchema: z.object({
      events: z.array(z.object({
        description: z.string().describe('Brief description of what happened'),
        isSignificant: z.boolean().describe('Whether this is plot-relevant'),
      })),
      movements: z.array(z.object({
        characterName: z.string(),
        destination: z.string().describe('Name of the location they are going to'),
      })).optional(),
    }),
  }),
},
```

### Prompt

```typescript
// lib/world/simulation.ts:173-178
prompt: `Analyze this conversation and extract significant events and any character movements:

${text}

List any important events (agreements made, information shared, conflicts).
If any character EXPLICITLY decides to leave for another location, report it in movements. Matches must be from: ${availableLocations}`,
```

### Final API Call

```typescript
// lib/world/simulation.ts:155-179
const result = await generateText({
  model: openrouter(modelId || models.fast),
  tools: { reportSimulation: tool({...}) },
  toolChoice: 'required',            // Must call the tool
  prompt: `Analyze this conversation...`,
});
```

### Prompt Order

```
1. prompt (single string):
   - Instruction: "Analyze this conversation..."
   - Full dialogue text from Prompt 3
   - Extraction instructions
   - Available location names for movement matching
   (tool definition provided via `tools` parameter)
```

---

## 6. Prompt 5: Off-Screen Simulation — Summary

**Purpose:** Generate a brief 1-2 sentence summary of what characters did off-screen. Used when simulation depth is `'summary'` (time since last interaction 10-20 ticks).

**File:** `lib/world/simulation.ts:38-68`
**Function:** `generateSummary(characters, locationName, timeElapsed, world, modelId)`
**Model:** `models.fast` (`openai/gpt-4o-mini`)

### Prompt (verbatim template)

```typescript
// lib/world/simulation.ts:49-56
prompt: `Summarize what likely happened between ${characterNames} over ${timeElapsed} time units at ${locationName}.

Characters:
${characters.map(c => `- ${c.name}: ${c.description}${c.goals ? `\n  Goal: ${c.goals}` : ''}`).join('\n')}

Scenario: ${world.scenario.description}

Write a brief 1-2 sentence summary of their interactions. Be specific but concise.`,
```

### Final API Call

```typescript
// lib/world/simulation.ts:47-57
const { text } = await generateText({
  model: openrouter(modelId || models.fast),
  prompt: `Summarize what likely happened...`,
});
```

### Prompt Order

```
1. prompt (single string):
   - Task: "Summarize what likely happened between..."
   - Character list with descriptions and goals
   - Scenario description
   - Length instruction
```

---

## 7. Prompt 6: Location Resolution

**Purpose:** Semantically match a free-text location description to an existing location cluster, or determine it's a new location.

**File:** `lib/world/locations.ts:10-88`
**Function:** `resolveLocation(description, existingClusters, modelId)`
**Model:** `models.fast` (`openai/gpt-4o-mini`)
**Called from:** `executeTools()` in `app/api/chat/route.ts:125-129` when processing `moveToLocation`

### Tool Definition

```typescript
// lib/world/locations.ts:35-42
tools: {
  resolveLocation: tool({
    description: 'Match a location description to an existing location or indicate it is new',
    inputSchema: z.object({
      matchedClusterId: z.string().nullable().describe('The id of the matched cluster, or null if no match'),
      canonicalName: z.string().describe('The canonical name for this location'),
      confidence: z.number().min(0).max(1).describe('Confidence in the match (0-1)'),
    }),
  }),
},
```

### Prompt (verbatim template)

```typescript
// lib/world/locations.ts:45-56
prompt: `Given this location description: "${description}"

And these existing locations:
${clusterList}

Determine if the description refers to one of the existing locations or is a new location.
Consider semantic similarity - "the cafe" matches "Coffee Shop", "town center" matches "Town Square", etc.

Call the resolveLocation tool with:
- matchedClusterId: the id of the matching location, or null if it's a new place
- canonicalName: the best canonical name for this location
- confidence: how confident you are in the match (0.0-1.0)`,
```

Where `clusterList` is:
```typescript
// lib/world/locations.ts:28-30
const clusterList = existingClusters
  .map((c, i) => `${i + 1}. "${c.canonicalName}" (id: ${c.id})`)
  .join('\n');
```

### Confidence Threshold

```typescript
// lib/world/locations.ts:72
const similarityThreshold = 0.6;
```

Matches below 0.6 confidence are treated as new locations.

### Fallback

If no clusters exist, skips the LLM call entirely and uses regex-based name extraction:

```typescript
// lib/world/locations.ts:93-103
export function extractCanonicalName(description: string): string {
  const cleaned = description
    .replace(/^(the|a|an|my|your|their|our|to|towards?|into)\s+/gi, '')
    .replace(/\s+(area|place|spot|room|building)$/i, '')
    .trim();
  return cleaned
    .split(' ')
    .slice(0, 4)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
```

### Prompt Order

```
1. prompt (single string):
   - The user's location description (quoted)
   - Numbered list of existing locations with IDs
   - Matching instructions with semantic similarity examples
   - Tool calling instructions
   (tool definition provided via `tools` parameter, toolChoice: 'required')
```

---

## 8. Chat History Handling

### No Truncation, Summarization, or Compression

The system sends **the entire chat history** to both the Logic Analysis and Narration models. There is no:
- Token counting or context budget
- Sliding window or message truncation
- Summarization of older messages
- Compression or lossy reduction

### Message Flow

1. **Client sends:** `UIMessage[]` from `useChat()` state
   (`components/chat/MainChatPanel.tsx:48` — `body: { worldState: world, ... }`)

2. **Server receives:** `messages: UIMessage[]`
   (`app/api/chat/route.ts:22`)

3. **"Continue" filtering:** Messages with content `"Continue"` or `"__SURAT_CONTINUE__"` from the user are stripped:
   ```typescript
   // app/api/chat/route.ts:37-55
   const filteredMessages = messages.filter((m) => {
     // ... checks content and parts for Continue/SURAT_CONTINUE
     return !(m.role === "user" && isContinue);
   });
   ```

4. **Conversion for Logic Analysis:** AI SDK `convertToModelMessages()` → then simplified to `{ role, content }`:
   ```typescript
   // app/api/chat/route.ts:65
   await convertToModelMessages(filteredMessages)
   // Then in action-analyzer.ts:104-107
   const openAiMessages: any[] = messages.map(m => ({ role: m.role, content: m.content }));
   ```

5. **Conversion for Narration:** Same `convertToModelMessages()` used directly:
   ```typescript
   // app/api/chat/route.ts:98
   messages: await convertToModelMessages(filteredMessages),
   ```

### Message Persistence

Messages are persisted client-side via `useChatPersistence` hook (`lib/hooks/use-chat-persistence.ts`), which stores them through the API client to server-side storage. On page reload, messages are hydrated back, and existing `stateDelta` metadata entries are marked as already-applied to avoid double-application (`components/chat/MainChatPanel.tsx:90-99`).

### Message Editing, Deletion, and Rewind

The client supports:
- **Edit:** Replaces the text part of a message in-place (`MainChatPanel.tsx:350-373`)
- **Delete:** Removes a single message by index (`MainChatPanel.tsx:334-338`)
- **Rewind:** Truncates history to a specific message index (`MainChatPanel.tsx:342-348`)
- **Regenerate:** Rolls back the last assistant message's state delta, removes created characters/events, then re-sends (`MainChatPanel.tsx:244-295`)

These operations modify the `messages` array before the next API call, so the server always receives the edited history.

---

## 9. World State as Context

### How World State Reaches the Prompt

The entire `WorldState` object is sent with every request from client to server. The server is stateless — it never persists world state.

```
Client (Zustand store)
  → JSON in request body
    → Server destructures worldState
      → Passes to analyzePlayerIntent() and buildSystemPrompt()
        → Dynamic variables interpolated into prompt strings
```

### WorldState Structure

**Defined at:** `types/world.ts:113-124`

```typescript
export interface WorldState {
  id: string;
  scenario: ScenarioConfig;        // Title, description, initial config
  time: WorldTime;                 // { tick: number, narrativeTime: string }
  characters: Character[];         // All characters (player + NPCs)
  locationClusters: LocationCluster[];  // Semantic location groups
  locations: Location[];           // Raw location descriptions with embeddings
  events: WorldEvent[];            // Everything that has happened
  conversations: Conversation[];   // Main + offscreen conversations
  playerCharacterId: string;
  mainConversationId: string;
}
```

### What Gets Into Prompts vs What Doesn't

| WorldState Field | Used in Logic Analysis | Used in Narration | Used in Simulation |
|------------------|:---------------------:|:-----------------:|:-----------------:|
| `scenario.title` | — | Yes | — |
| `scenario.description` | — | Yes | Yes |
| `time.narrativeTime` | Yes | Yes | Yes |
| `time.tick` | — | Yes | — |
| `characters[].name` | Yes (filtered) | Yes (filtered) | Yes (filtered) |
| `characters[].description` | — | Yes | Yes |
| `characters[].knowledge` | — | Yes (last 3) | — |
| `characters[].goals` | — | — | Yes |
| `characters[].relationships` | — | — | Yes |
| `characters[].isDiscovered` | Yes (filter) | Yes (filter) | Yes (filter) |
| `characters[].encounterChance` | — | — | — |
| `locationClusters[].canonicalName` | Yes (current) | Yes (all) | Yes (all) |
| `events[].description` | — | Yes (last 5) | Yes (last 15) |
| `conversations` | — | — | — |
| `locations` (raw) | — | — | — |

### Scenario Configuration Origin

Scenarios are defined as TypeScript objects:

- `data/default-scenario.ts` — "The Quiet Town" (6 characters, 4 locations)
- `data/scenarios/azure-lotus.ts` — "The Azure Lotus" (8 characters, 8 locations)
- `data/scenarios/index.ts` — exports `builtinScenarios` array

Validated by Zod schemas at `types/scenario.ts:3-26`.

Initialized into WorldState by `store/world-store.ts:60-143` (`initializeScenario`), which:
- Creates UUIDs for all entities
- Maps location names to cluster IDs
- Sets `isDiscovered: true` for characters at the player's starting location
- Creates the main conversation

---

## 10. Model Routing

**Defined at:** `lib/ai/openrouter.ts:8-17`

```typescript
export const models = {
  mainConversation: 'z-ai/glm-4.6:exacto',       // Narration, full simulation dialogue
  offscreenSimulation: 'z-ai/glm-4.6:exacto',     // (defined but not referenced directly)
  fast: 'openai/gpt-4o-mini',                      // Logic analysis, summaries, extraction, location resolution
  embedding: 'openai/text-embedding-3-small',       // (not used in prompt construction)
} as const;
```

### User-Selectable Model Override

Available models at `lib/ai/models.ts:2-8`:

```typescript
export const AVAILABLE_MODELS = [
    'deepseek/deepseek-v3.1-terminus:exacto',
    'openai/gpt-oss-120b:exacto',
    'qwen/qwen3-coder:exacto',
    'moonshotai/kimi-k2-0905:exacto',
    'z-ai/glm-4.6:exacto',
] as const;
```

The client default is `DEFAULT_MODEL` = `AVAILABLE_MODELS[0]` (`deepseek/deepseek-v3.1-terminus:exacto`), persisted in localStorage via `store/settings-store.ts:10-21`. The server validates the model (`lib/ai/models.ts:14-16`) and falls back to `models.mainConversation` if invalid:

```typescript
// app/api/chat/route.ts:33-34
const modelId = rawModelId && isValidModel(rawModelId) ? rawModelId : undefined;

// app/api/chat/route.ts:96
model: openrouter(modelId || models.mainConversation),
```

So the effective narration model is: **user's selection** (if valid) → **`z-ai/glm-4.6:exacto`** (fallback).

`models.fast` is **always** used for intent analysis (hardcoded at `lib/chat/action-analyzer.ts:111`).

### Two Different API Clients

| Prompt | API Client | Provider |
|--------|-----------|----------|
| Logic Analysis | Direct `openai` SDK (`lib/chat/action-analyzer.ts:6-9`) | OpenRouter via baseURL |
| Narration | AI SDK `streamText()` with `@openrouter/ai-sdk-provider` | OpenRouter via provider |
| Simulation | AI SDK `generateText()` with `@openrouter/ai-sdk-provider` | OpenRouter via provider |
| Location Resolution | AI SDK `generateText()` with `@openrouter/ai-sdk-provider` | OpenRouter via provider |

The Logic Analysis uses direct OpenAI SDK because the tool schemas are defined as raw JSON (avoiding Zod 4 incompatibility noted at `lib/chat/action-analyzer.ts:11`).

---

## 11. User Input Preprocessing

### Continue Button

The client has a "Continue" button (`MainChatPanel.tsx:311-315`) that sends `"__SURAT_CONTINUE__"` as a user message. This triggers the LLM to continue narrating without player action.

On the server, these messages are filtered out before building the prompt:

```typescript
// app/api/chat/route.ts:37-55
const filteredMessages = messages.filter((m) => {
  let isContinue = content === "Continue" || content === "__SURAT_CONTINUE__";
  // Also checks parts array for the same values
  return !(m.role === "user" && isContinue);
});
```

After the response completes, the client also cleans up the trigger message from local state (`MainChatPanel.tsx:56-74`).

### Time Advance on Input

Every user submission advances world time by 1 tick before sending:

```typescript
// MainChatPanel.tsx:305
advanceTime(1);
```

This means the world state sent to the server already reflects the 1-tick advance from the user's action.

### No Other Preprocessing

There is no:
- Macro expansion or variable substitution in user text
- Command parsing (like `/roll` or `/ooc`)
- Regex filtering or content moderation
- Token counting of user input

---

## 12. What This System Does NOT Have

To be explicit about features common in other roleplay/chat systems that are **absent** here:

| Feature | Status |
|---------|--------|
| **Lorebook / World Info** | Not present. World knowledge is encoded in character descriptions, knowledge entries, and events — all part of WorldState, not a separate keyword-triggered system. |
| **Author's Note / Editorial Injection** | Not present. No mid-conversation instruction injection at configurable depth. |
| **User Persona / Profile** | Not present. The player character has a `description` field but it's not injected into the prompt separately — it's part of the character list. |
| **Context Window Budget / Token Counting** | Not present. Full history is sent every time. The only truncation is `slice(-5)` for events and `slice(-3)` for knowledge. |
| **Prompt Format Templates** | Not present. No ChatML, Alpaca, or other format templates. The system uses the AI SDK and OpenAI API's native chat format (system + messages array). |
| **Stop Sequences** | Not explicitly configured. AI SDK's `stopWhen: stepCountIs(5)` limits reasoning steps, not stop tokens. |
| **Message Summarization** | Not present. No older-message compression or rolling summaries. |
| **Few-Shot Example Messages** | Two hardcoded examples in the narrator system prompt only. No configurable example message system. |
| **RAG / Vector Search** | Location clusters have `centroidEmbedding` fields and the embedding model is configured, but no retrieval-augmented generation is used in prompt construction. |

---

## 13. Final Prompt Layout Diagrams

### Prompt 1: Logic Analysis

```
┌─────────────────────────────────────────┐
│ system                                  │
│ ┌─────────────────────────────────────┐ │
│ │ "You are the Game Logic Engine..."  │ │
│ │                                     │ │
│ │ Current State:                      │ │
│ │ - Location: {canonicalName}         │ │
│ │ - Time: {narrativeTime}             │ │
│ │ - Characters Here: {names}          │ │
│ │                                     │ │
│ │ Tools Available:                    │ │
│ │ - moveToLocation                    │ │
│ │ - advanceTime                       │ │
│ │ - discoverCharacter                 │ │
│ │                                     │ │
│ │ "If the user is just talking..."    │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ messages[]                              │
│ ┌─────────────────────────────────────┐ │
│ │ user: "I walk to the library"       │ │
│ │ assistant: "You step outside..."    │ │
│ │ user: "I look around"              │ │
│ │ ... (full filtered history)         │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ tools (via API parameter)               │
│ ┌─────────────────────────────────────┐ │
│ │ moveToLocation(destination,         │ │
│ │   narrativeTime, accompaniedBy)     │ │
│ │ advanceTime(narrativeTime, ticks)   │ │
│ │ discoverCharacter(characterName,    │ │
│ │   introduction, goals)              │ │
│ └─────────────────────────────────────┘ │
│ tool_choice: "auto"                     │
├─────────────────────────────────────────┤
│ model: openai/gpt-4o-mini               │
└─────────────────────────────────────────┘
```

### Prompt 2: Narration

```
┌─────────────────────────────────────────┐
│ system                                  │
│ ┌─────────────────────────────────────┐ │
│ │ 'You are the narrator and game      │ │
│ │  master of "{scenario.title}"'      │ │
│ │                                     │ │
│ │ SCENARIO: {scenario.description}    │ │
│ │                                     │ │
│ │ CURRENT LOCATION: {canonicalName}   │ │
│ │ OTHER KNOWN LOCATIONS: {list}       │ │
│ │ TIME: {narrativeTime} (tick {n})    │ │
│ │                                     │ │
│ │ CHARACTERS PRESENT:                 │ │
│ │ - {name}: {description}             │ │
│ │     Knows: {last 3 knowledge}       │ │
│ │ - {name}: {description}             │ │
│ │ (NOTE: undiscovered warning)        │ │
│ │ HIDDEN: {undiscovered names}        │ │
│ │                                     │ │
│ │ RECENT EVENTS:                      │ │
│ │ - {last 5 event descriptions}       │ │
│ │                                     │ │
│ │ YOUR ROLE: (7 behavioral rules)     │ │
│ │                                     │ │
│ │ EXAMPLES: (2 few-shot examples)     │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ messages[]                              │
│ ┌─────────────────────────────────────┐ │
│ │ (full filtered chat history via     │ │
│ │  convertToModelMessages)            │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ tools: {} (empty — narrator has none)   │
│ stopWhen: stepCountIs(5)                │
├─────────────────────────────────────────┤
│ model: {user-selected} or              │
│        z-ai/glm-4.6:exacto             │
└─────────────────────────────────────────┘
```

### Prompt 3: Full Simulation Dialogue

```
┌─────────────────────────────────────────┐
│ prompt (single-turn generation)         │
│ ┌─────────────────────────────────────┐ │
│ │ "You are simulating a conversation  │ │
│ │  between {names} at {location}"     │ │
│ │                                     │ │
│ │ Characters:                         │ │
│ │ - {name}: {description}             │ │
│ │   Goal: {goals}                     │ │
│ │                                     │ │
│ │ {Relationships between present}     │ │
│ │                                     │ │
│ │ SHARED HISTORY:                     │ │
│ │ - [{timestamp}] {description}       │ │
│ │                                     │ │
│ │ Scenario: {description}             │ │
│ │ Time: {narrativeTime}               │ │
│ │ Available Locations: {all names}    │ │
│ │                                     │ │
│ │ (Formatting instructions)           │ │
│ │ "Generate approximately {n}         │ │
│ │  exchanges."                        │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ model: z-ai/glm-4.6:exacto             │
└─────────────────────────────────────────┘
```

### Prompt 4: Event Extraction

```
┌─────────────────────────────────────────┐
│ prompt (single-turn with tool)          │
│ ┌─────────────────────────────────────┐ │
│ │ "Analyze this conversation..."      │ │
│ │ {full dialogue text from Prompt 3}  │ │
│ │ "List any important events..."      │ │
│ │ "Matches must be from: {locations}" │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ tools: reportSimulation(events[],       │
│        movements[])                     │
│ toolChoice: "required"                  │
├─────────────────────────────────────────┤
│ model: openai/gpt-4o-mini               │
└─────────────────────────────────────────┘
```

### Prompt 5: Summary

```
┌─────────────────────────────────────────┐
│ prompt (single-turn generation)         │
│ ┌─────────────────────────────────────┐ │
│ │ "Summarize what likely happened     │ │
│ │  between {names} over {n} time      │ │
│ │  units at {location}."              │ │
│ │                                     │ │
│ │ Characters:                         │ │
│ │ - {name}: {description}             │ │
│ │   Goal: {goals}                     │ │
│ │                                     │ │
│ │ Scenario: {description}             │ │
│ │                                     │ │
│ │ "Write a brief 1-2 sentence         │ │
│ │  summary..."                        │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ model: openai/gpt-4o-mini               │
└─────────────────────────────────────────┘
```

### Prompt 6: Location Resolution

```
┌─────────────────────────────────────────┐
│ prompt (single-turn with tool)          │
│ ┌─────────────────────────────────────┐ │
│ │ 'Given this location description:   │ │
│ │  "{user's description}"'            │ │
│ │                                     │ │
│ │ "And these existing locations:"     │ │
│ │ 1. "Coffee Shop" (id: abc-123)      │ │
│ │ 2. "Library" (id: def-456)          │ │
│ │                                     │ │
│ │ "Determine if the description       │ │
│ │  refers to one of the existing      │ │
│ │  locations or is a new location."   │ │
│ │                                     │ │
│ │ (Semantic similarity examples)      │ │
│ │ (Tool calling instructions)         │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ tools: resolveLocation(                 │
│   matchedClusterId, canonicalName,      │
│   confidence)                           │
│ toolChoice: "required"                  │
├─────────────────────────────────────────┤
│ model: openai/gpt-4o-mini               │
└─────────────────────────────────────────┘
```

---

### End-to-End Request Flow

```
User types "I walk to the library"
         │
         ▼
┌─ MainChatPanel.tsx ──────────────────┐
│ advanceTime(1)                       │
│ sendMessage({ text: input })         │
│ body: { worldState, modelId,         │
│         lastSimulationTick }         │
└──────────────────────────────────────┘
         │
         ▼  POST /api/chat
┌─ route.ts ───────────────────────────┐
│                                      │
│ 1. Filter "Continue" messages        │
│                                      │
│ 2. PHASE 1: Logic Analysis           │
│    analyzePlayerIntent()             │
│    → Prompt 1 sent to gpt-4o-mini    │
│    → Returns: moveToLocation({       │
│        destination: "the library"    │
│      })                              │
│                                      │
│ 3. PHASE 2: Tool Execution           │
│    executeTools()                    │
│    ├─ resolveLocation("the library") │
│    │  → Prompt 6 to gpt-4o-mini      │
│    │  → Returns: { clusterId, ... }  │
│    └─ Build StateDelta               │
│                                      │
│ 4. applyDeltaToWorldState()          │
│    → effectiveWorldState with        │
│       player at Library              │
│                                      │
│ 5. PHASE 3: Narration                │
│    buildSystemPrompt(effective)      │
│    → Prompt 2 sent to glm-4.6       │
│    → Streams narrative response      │
│                                      │
│ 6. Return stream + stateDelta        │
│    as message metadata               │
└──────────────────────────────────────┘
         │
         ▼
┌─ MainChatPanel.tsx ──────────────────┐
│ Apply stateDelta:                    │
│ - advanceTime(5)                     │
│ - moveCharacter(player, libraryId)   │
│ - If simulationNeeded:               │
│   └─ api.simulate() → POST /api/sim │
│      → Prompts 3+4 or 5             │
│      → Events added to WorldState   │
└──────────────────────────────────────┘
```
