import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai';
import { z } from 'zod';
import { openrouter, models } from '@/lib/ai/openrouter';
import type { WorldState } from '@/types/world';
import { TIME_COSTS } from '@/types/world';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, worldState, modelId } = await req.json() as {
    messages: UIMessage[];
    worldState: WorldState;
    modelId?: string;
  };

  // Filter out the "Continue" trigger message so the LLM sees a natural continuation
  // of the history (e.g. [User, Assistant] -> Generate next Assistant response)
  const filteredMessages = messages.filter(m => {
    const msg = m as any;
    const content = msg.content;
    let isContinue = content === 'Continue' || content === '__SURAT_CONTINUE__';

    // Also check parts if content is empty/undefined or not a continue message
    if (!isContinue && Array.isArray(msg.parts)) {
      const textPart = msg.parts.find((p: any) => p.type === 'text' && (p.text === 'Continue' || p.text === '__SURAT_CONTINUE__'));
      if (textPart) {
        isContinue = true;
      }
    }

    return !(m.role === 'user' && isContinue);
  });

  const player = worldState.characters.find(c => c.id === worldState.playerCharacterId);
  const undiscoveredHere = worldState.characters.filter(
    c => !c.isPlayer && !c.isDiscovered && c.currentLocationClusterId === player?.currentLocationClusterId
  );
  console.log('[CHAT API] Hidden characters at player location:', undiscoveredHere.map(c => c.name));

  const systemPrompt = buildSystemPrompt(worldState);

  const result = streamText({
    model: openrouter(modelId || models.mainConversation),
    system: systemPrompt,
    messages: await convertToModelMessages(filteredMessages),
    tools: {
      moveToLocation: {
        description: 'Call this when the player moves to a different location. This advances time and updates their position.',
        inputSchema: z.object({
          destination: z.string().describe('Brief description of where they are going'),
          narrativeTime: z.string().nullable().optional().describe('New narrative time if significant time passes (e.g., "Evening", "The next morning")'),
        }),
        execute: async ({ destination, narrativeTime }) => {
          // Find the target location in the static world state
          const targetLocation = worldState.locationClusters.find(
            l => l.canonicalName.toLowerCase().includes(destination.toLowerCase())
          );

          let context = '';
          if (targetLocation) {
            const charactersThere = worldState.characters.filter(
              c => c.currentLocationClusterId === targetLocation.id && !c.isPlayer
            );

            const charDescriptions = charactersThere.map(c => {
              const status = c.isDiscovered ? '' : ' (Undiscovered - YOU MUST CALL discoverCharacter)';
              return `${c.name}${status}`;
            }).join(', ');

            context = `Moved to ${targetLocation.canonicalName}. Characters here: ${charDescriptions || 'None'}.`;
          }

          return {
            type: 'movement' as const,
            destination,
            narrativeTime,
            timeCost: TIME_COSTS.move,
            context, // Provide context for the next step
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
        description: 'Call this when the player encounters or notices a new character (hidden or improvised). CALL THIS SEPARATELY FOR EACH CHARACTER IF MULTIPLE ARE FOUND.',
        inputSchema: z.object({
          characterName: z.string().describe('Name of the character being discovered'),
          introduction: z.string().describe('How they are introduced or noticed'),
          goals: z.string().optional().describe('Inferred or stated goals of the character (e.g. "To find her brother", "To stop the player")'),
        }),
        execute: async ({ characterName, introduction, goals }) => {
          return {
            type: 'character_discovery' as const,
            characterName,
            introduction,
            goals,
          };
        },
      },
    },
    stopWhen: stepCountIs(5),
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

Tools:
- Use moveToLocation when the player goes somewhere new
- Use advanceTime when significant time passes (long conversations, waiting, etc.)
- Use discoverCharacter when introducing ANY new character (hidden or improvised)

IMPORTANT:
- Stay in character as the narrator
- Never break the fourth wall
- Don't explain game mechanics
- Let the player drive the story
- If you introduce or mention any character (whether from the "HIDDEN" list or a new one you create), you MUST call the discoverCharacter tool for them. Do not just describe them; use the tool to make them official.
- Check the recent history: if a character has been speaking or present but is NOT in the "CHARACTERS PRESENT" list above, call discoverCharacter for them immediately!
- You can call multiply tools in a single turn if needed (e.g. discovering two characters).

EXAMPLES:
User: "I look around and see a mysterious woman named Sarah standing in the shadows."
Assistant: [Calls discoverCharacter({ characterName: "Sarah", introduction: "A mysterious woman standing in the shadows" })]

User: "I walk into the tavern. The bartender, Joe, nods at me. There's also an old sailor named Pete in the corner."
Assistant: [Calls discoverCharacter({ characterName: "Joe", introduction: "The bartender at the tavern" }), Calls discoverCharacter({ characterName: "Pete", introduction: "An old sailor in the corner" })]`;
}
