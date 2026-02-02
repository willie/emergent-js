import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { openrouter, models } from '@/lib/ai/openrouter';
import type { WorldState } from '@/types/world';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, worldState } = await req.json() as {
    messages: UIMessage[];
    worldState: WorldState;
  };

  const systemPrompt = buildSystemPrompt(worldState);

  const result = streamText({
    model: openrouter(models.mainConversation),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}

function buildSystemPrompt(world: WorldState): string {
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
    .map(c => `- ${c.name}: ${c.description}`)
    .join('\n');

  const recentEvents = world.events
    .slice(-5)
    .map(e => `- ${e.description}`)
    .join('\n');

  return `You are the narrator and game master of an interactive narrative experience called "${world.scenario.title}".

SCENARIO: ${world.scenario.description}

CURRENT LOCATION: ${playerLocation?.canonicalName ?? 'Unknown'}
TIME: ${world.time.narrativeTime}

CHARACTERS PRESENT:
${characterDescriptions || '(No one else is here)'}

${recentEvents ? `RECENT EVENTS:\n${recentEvents}\n` : ''}

YOUR ROLE:
- Narrate the world and characters in response to what the player does
- Play the characters present - give them distinct voices and personalities
- Characters should only know what they have witnessed or been told
- When the player moves to a new location, describe it vividly
- Include sensory details and atmosphere
- Keep responses focused and not overly long
- Characters can suggest actions but never force the player

IMPORTANT:
- Stay in character as the narrator
- Never break the fourth wall
- Don't explain game mechanics
- Let the player drive the story`;
}
