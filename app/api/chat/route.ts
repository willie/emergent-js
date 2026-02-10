import { streamText, convertToModelMessages, stepCountIs, type UIMessage, ToolCallPart, ToolResultPart, OpenAIStream, StreamingTextResponse } from 'ai';
import { z } from 'zod';
import { openrouter, models } from '@/lib/ai/openrouter';
import type { WorldState } from '@/types/world';
import { TIME_COSTS } from '@/types/world';
import { analyzePlayerIntent, GAME_TOOLS_CUSTOM_SCHEMA, openai } from '@/lib/chat/action-analyzer'; // Import manual tools and client

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, worldState, modelId } = await req.json() as {
    messages: UIMessage[];
    worldState: WorldState;
    modelId?: string;
  };

  // Filter out "Continue" messages as before
  const filteredMessages = messages.filter(m => {
    const msg = m as any;
    const content = msg.content;
    let isContinue = content === 'Continue' || content === '__SURAT_CONTINUE__';

    if (!isContinue && Array.isArray(msg.parts)) {
      const textPart = msg.parts.find((p: any) => p.type === 'text' && (p.text === 'Continue' || p.text === '__SURAT_CONTINUE__'));
      if (textPart) {
        isContinue = true;
      }
    }

    return !(m.role === 'user' && isContinue);
  });

  // STAGE 1: LOGIC ANALYSIS
  const lastMessage = filteredMessages[filteredMessages.length - 1];
  let pendingToolCalls: any[] = [];
  let actionContext = '';

  const isToolResultResponse = lastMessage.role === 'tool' || (Array.isArray(lastMessage.parts) && lastMessage.parts.some((p: any) => p.type === 'tool-result'));

  console.log('[CHAT API] Received Request. Last Message Role:', lastMessage.role, 'Is Tool Result:', isToolResultResponse);

  if (!isToolResultResponse && lastMessage.role === 'user') {
    console.log('[CHAT API] Starting Logic Analysis...');
    const analysis = await analyzePlayerIntent(await convertToModelMessages(filteredMessages), worldState, modelId);

    if (analysis.toolCalls && analysis.toolCalls.length > 0) {
      console.log('[CHAT API] Logic Phase detected actions:', analysis.toolCalls.map(t => t.toolName));
      pendingToolCalls = analysis.toolCalls;
      actionContext = analysis.context;
    } else {
      console.log('[CHAT API] Logic Phase: No actions detected.');
    }
  } else if (isToolResultResponse) {
    console.log('[CHAT API] Processing Tool Result. Skipping Analysis.');
  }

  // STAGE 2: ACTION EXECUTION (EMITTER)
  if (pendingToolCalls.length > 0) {
    console.log('[CHAT API] Logic Phase: Emitting tool calls via Fast model.');

    const emissionPrompt = `You are a hidden system agent responsible for executing game logic.
The Logic Engine has determined the user intends to:
${pendingToolCalls.map(t => `- ${t.toolName}(${JSON.stringify(t.args)})`).join('\n')}

INSTRUCTIONS:
1. CALL THESE TOOLS EXACTLY AS SPECIFIED.
2. DO NOT GENERATE ANY CONTENT / NARRATIVE.
3. EXECUTE IMMEDIATELY.`;

    const openAiMessages = (await convertToModelMessages(filteredMessages)).map(m => ({
      role: m.role as 'user' | 'assistant' | 'system', // Cast loosely
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) // Simplify
    }));

    // Use manual OpenAI client to emit tools, bypassing 'ai' SDK schema generation
    const response = await openai.chat.completions.create({
      model: models.fast,
      messages: [
        { role: 'system', content: emissionPrompt },
        ...openAiMessages
      ],
      tools: GAME_TOOLS_CUSTOM_SCHEMA,
      stream: true,
    });

    // Pipe generic OpenAI stream to AI SDK stream
    const stream = OpenAIStream(response);
    console.log('[CHAT API] Returning Emitter stream (Manual OpenAI).');
    return new StreamingTextResponse(stream);
  }

  // STAGE 3: NARRATION
  console.log('[CHAT API] Narrative Phase: generating story (No Tools).');

  const systemPrompt = buildSystemPrompt(worldState, actionContext);

  const result = streamText({
    model: openrouter(modelId || models.mainConversation),
    system: systemPrompt,
    messages: await convertToModelMessages(filteredMessages),
    tools: {}, // NO TOOLS ALLOWED
    stopWhen: stepCountIs(5),
  });

  console.log('[CHAT API] Returning Narrator stream.');
  return result.toUIMessageStreamResponse();
}

function buildSystemPrompt(world: WorldState, actionContext: string = ''): string {
  const player = world.characters.find(c => c.id === world.playerCharacterId);
  const playerLocation = world.locationClusters.find(
    c => c.id === player?.currentLocationClusterId
  );

  const presentCharacters = world.characters.filter(
    c => !c.isPlayer &&
      c.isDiscovered &&
      c.currentLocationClusterId === player?.currentLocationClusterId
  );

  const characterDescriptions = presentCharacters
    .map(c => {
      const knowledgeStr = c.knowledge.length > 0
        ? `\n    Knows: ${c.knowledge.slice(-3).map(k => k.content).join('; ')}`
        : '';
      return `- ${c.name}: ${c.description}${knowledgeStr}`;
    })
    .join('\n');

  const recentEvents = world.events
    .slice(-5)
    .map(e => `- ${e.description}`)
    .join('\n');

  const undiscoveredHere = world.characters.filter(
    c => !c.isPlayer &&
      !c.isDiscovered &&
      c.currentLocationClusterId === player?.currentLocationClusterId
  );

  const undiscoveredHint = undiscoveredHere.length > 0
    ? `\nHIDDEN (can be discovered if player looks around or circumstances arise): ${undiscoveredHere.map(c => c.name).join(', ')}`
    : '';

  const otherLocations = world.locationClusters
    .filter(loc => loc.id !== player?.currentLocationClusterId)
    .map(loc => loc.canonicalName)
    .join(', ');

  return `You are the narrator and game master of an interactive narrative experience called "${world.scenario.title}".

SCENARIO: ${world.scenario.description}

CURRENT LOCATION: ${playerLocation?.canonicalName ?? 'Unknown'}
OTHER KNOWN LOCATIONS: ${otherLocations || 'None yet'}
TIME: ${world.time.narrativeTime} (tick ${world.time.tick})

CHARACTERS PRESENT (SYSTEM STATE):
${characterDescriptions || '(No one else is here)'}
(NOTE: If a character is participating in the conversation but is NOT listed above, they are not yet discovered. You MUST call discoverCharacter for them immediately.)
${undiscoveredHint}

${recentEvents ? `RECENT EVENTS:\n${recentEvents}\n` : ''}

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
}
