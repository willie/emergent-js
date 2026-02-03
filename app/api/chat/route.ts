import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai';
import { z } from 'zod';
import { openrouter, models } from '@/lib/ai/openrouter';
import type { WorldState } from '@/types/world';
import { TIME_COSTS } from '@/types/world';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, worldState } = await req.json() as {
    messages: UIMessage[];
    worldState: WorldState;
  };

  const player = worldState.characters.find(c => c.id === worldState.playerCharacterId);
  const undiscoveredHere = worldState.characters.filter(
    c => !c.isPlayer && !c.isDiscovered && c.currentLocationClusterId === player?.currentLocationClusterId
  );
  console.log('[CHAT API] Hidden characters at player location:', undiscoveredHere.map(c => c.name));

  const systemPrompt = buildSystemPrompt(worldState);

  const result = streamText({
    model: openrouter(models.mainConversation),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: {
      moveToLocation: {
        description: 'Call this when the player moves to a different location. This advances time and updates their position.',
        inputSchema: z.object({
          destination: z.string().describe('Brief description of where they are going'),
          narrativeTime: z.string().optional().describe('New narrative time if significant time passes (e.g., "Evening", "The next morning")'),
        }),
        execute: async ({ destination, narrativeTime }) => {
          return {
            type: 'movement' as const,
            destination,
            narrativeTime,
            timeCost: TIME_COSTS.move,
          };
        },
      },
      advanceTime: {
        description: 'Call this when significant time passes without movement (e.g., a long conversation, waiting)',
        inputSchema: z.object({
          narrativeTime: z.string().describe('New narrative time description'),
          ticks: z.number().optional().describe('How many time units pass (default: 5)'),
        }),
        execute: async ({ narrativeTime, ticks }) => {
          return {
            type: 'time_advance' as const,
            narrativeTime,
            timeCost: ticks ?? 5,
          };
        },
      },
      discoverCharacter: {
        description: 'Call this when the player encounters or notices a new character for the first time',
        inputSchema: z.object({
          characterName: z.string().describe('Name of the character being discovered'),
          introduction: z.string().describe('How they are introduced or noticed'),
        }),
        execute: async ({ characterName, introduction }) => {
          return {
            type: 'character_discovery' as const,
            characterName,
            introduction,
          };
        },
      },
    },
    stopWhen: stepCountIs(3),
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

  // Build character descriptions with their knowledge
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

  // List undiscovered characters at current location (for potential discovery)
  const undiscoveredHere = world.characters.filter(
    c => !c.isPlayer &&
    !c.isDiscovered &&
    c.currentLocationClusterId === player?.currentLocationClusterId
  );

  const undiscoveredHint = undiscoveredHere.length > 0
    ? `\nHIDDEN (can be discovered if player looks around or circumstances arise): ${undiscoveredHere.map(c => c.name).join(', ')}`
    : '';

  // List other locations the player knows about
  const otherLocations = world.locationClusters
    .filter(loc => loc.id !== player?.currentLocationClusterId)
    .map(loc => loc.canonicalName)
    .join(', ');

  return `You are the narrator and game master of an interactive narrative experience called "${world.scenario.title}".

SCENARIO: ${world.scenario.description}

CURRENT LOCATION: ${playerLocation?.canonicalName ?? 'Unknown'}
OTHER KNOWN LOCATIONS: ${otherLocations || 'None yet'}
TIME: ${world.time.narrativeTime} (tick ${world.time.tick})

CHARACTERS PRESENT:
${characterDescriptions || '(No one else is here)'}
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

TOOLS:
- Use moveToLocation when the player goes somewhere new
- Use advanceTime when significant time passes (long conversations, waiting, etc.)
- Use discoverCharacter when introducing a hidden character

IMPORTANT:
- Stay in character as the narrator
- Never break the fourth wall
- Don't explain game mechanics
- Let the player drive the story`;
}
