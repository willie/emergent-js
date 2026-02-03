// ... keeping imports (lines 1-4)
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { openrouter, models } from '@/lib/ai/openrouter';
import type { Character, WorldState, WorldEvent, Message, Conversation } from '@/types/world';

type SimulationDepth = 'full' | 'summary' | 'skip';

/**
 * Determine how deeply to simulate interactions between characters.
 */
function determineSimulationDepth(
  timeSinceLastInteraction: number,
  hasUnresolvedPlotPoints: boolean
): SimulationDepth {
  if (timeSinceLastInteraction < 5) return 'skip';
  if (hasUnresolvedPlotPoints || timeSinceLastInteraction > 20) return 'full';
  if (timeSinceLastInteraction > 10) return 'summary';
  return 'skip';
}

/**
 * Group characters by their current location.
 */
function groupCharactersByLocation(characters: Character[]): Map<string, Character[]> {
  const groups = new Map<string, Character[]>();
  for (const char of characters) {
    const existing = groups.get(char.currentLocationClusterId) || [];
    existing.push(char);
    groups.set(char.currentLocationClusterId, existing);
  }
  return groups;
}

/**
 * Generate a summary of what characters did while apart.
 */
async function generateSummary(
  characters: Character[],
  locationName: string,
  timeElapsed: number,
  world: WorldState
): Promise<WorldEvent> {
  const characterNames = characters.map(c => c.name).join(' and ');

  const { text } = await generateText({
    model: openrouter(models.fast),
    prompt: `Summarize what likely happened between ${characterNames} over ${timeElapsed} time units at ${locationName}.

Characters:
${characters.map(c => `- ${c.name}: ${c.description}${c.goals ? `\n  Goal: ${c.goals}` : ''}`).join('\n')}

Scenario: ${world.scenario.description}

Write a brief 1-2 sentence summary of their interactions. Be specific but concise.`,
  });

  return {
    id: crypto.randomUUID(),
    timestamp: world.time.tick,
    locationClusterId: characters[0].currentLocationClusterId,
    involvedCharacterIds: characters.map(c => c.id),
    description: text.trim(),
    witnessedByIds: characters.map(c => c.id),
    isOffscreen: true,
  };
}

/**
 * Run a full dialogue simulation between characters.
 */
async function runFullSimulation(
  characters: Character[],
  locationName: string,
  timeElapsed: number,
  world: WorldState
): Promise<{
  events: WorldEvent[];
  messages: Message[];
  conversation: Omit<Conversation, 'id'>,
  movements: { characterId: string; newLocationId: string }[]
}> {
  const characterNames = characters.map(c => c.name).join(' and ');
  const turnCount = Math.min(Math.ceil(timeElapsed / 2), 8);

  // Get available locations for characters to potentially move to
  const availableLocations = world.locationClusters
    .map(l => l.canonicalName)
    .join(', ');

  const systemPrompt = `You are simulating a conversation between ${characterNames} at ${locationName}.

Characters:
${characters.map(c => `- ${c.name}: ${c.description}${c.goals ? `\n  Goal: ${c.goals}` : ''}`).join('\n')}

Scenario: ${world.scenario.description}
Time: ${world.time.narrativeTime}
Available Locations (for movement): ${availableLocations}

Write a natural dialogue between these characters. Each character should stay in character.
Format each line as: CHARACTER_NAME: "dialogue"
Include brief action descriptions in *asterisks* when appropriate.
If characters decide to go somewhere else, they should express it in dialogue.

Generate approximately ${turnCount} exchanges.`;

  const { text } = await generateText({
    model: openrouter(models.mainConversation),
    prompt: systemPrompt,
  });

  // Parse the dialogue into messages
  const messages: Message[] = [];
  const lines = text.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const match = line.match(/^([A-Za-z]+):\s*(.+)$/);
    if (match) {
      const [, name, content] = match;
      const speaker = characters.find(c =>
        c.name.toLowerCase() === name.toLowerCase()
      );

      messages.push({
        id: crypto.randomUUID(),
        conversationId: '',
        role: 'assistant',
        content: content.replace(/^["']|["']$/g, '').trim(),
        timestamp: world.time.tick,
        speakerId: speaker?.id,
      });
    }
  }

  // Extract key events and movements using tool calling
  const result = await generateText({
    model: openrouter(models.fast),
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
    toolChoice: 'required',
    prompt: `Analyze this conversation and extract significant events and any character movements:

${text}

List any important events (agreements made, information shared, conflicts).
If any character EXPLICITLY decides to leave for another location, report it in movements. Matches must be from: ${availableLocations}`,
  });

  let extractedEvents: { description: string; isSignificant: boolean }[] = [];
  let extractedMovements: { characterName: string; destination: string }[] = [];

  const toolCall = result.toolCalls[0] as any;
  if (toolCall && toolCall.toolName === 'reportSimulation') {
    extractedEvents = toolCall.input.events;
    extractedMovements = toolCall.input.movements || [];
  }

  const events: WorldEvent[] = extractedEvents
    .filter(e => e.isSignificant)
    .map(e => ({
      id: crypto.randomUUID(),
      timestamp: world.time.tick,
      locationClusterId: characters[0].currentLocationClusterId,
      involvedCharacterIds: characters.map(c => c.id),
      description: e.description,
      witnessedByIds: characters.map(c => c.id),
      isOffscreen: true,
    }));

  const conversation: Omit<Conversation, 'id'> = {
    type: 'offscreen',
    locationClusterId: characters[0].currentLocationClusterId,
    participantIds: characters.map(c => c.id),
    messages,
    isActive: true,
  };

  // Resolve movements to IDs
  const movements: { characterId: string; newLocationId: string }[] = [];
  for (const move of extractedMovements) {
    const char = characters.find(c => c.name.toLowerCase() === move.characterName.toLowerCase());
    const loc = world.locationClusters.find(l =>
      l.canonicalName.toLowerCase().includes(move.destination.toLowerCase()) ||
      move.destination.toLowerCase().includes(l.canonicalName.toLowerCase())
    );

    if (char && loc && loc.id !== char.currentLocationClusterId) {
      movements.push({
        characterId: char.id,
        newLocationId: loc.id
      });
    }
  }

  return { events, messages, conversation, movements };
}

/**
 * Simulate off-screen interactions between characters.
 */
export async function simulateOffscreen(
  world: WorldState,
  playerLocationClusterId: string,
  timeSinceLastSimulation: number
): Promise<{
  events: WorldEvent[];
  conversations: Omit<Conversation, 'id'>[];
  characterUpdates: { characterId: string; newLocationId: string }[];
}> {
  // Get non-player characters not at player's location
  const absentCharacters = world.characters.filter(
    c => !c.isPlayer &&
      c.isDiscovered &&
      c.currentLocationClusterId !== playerLocationClusterId
  );

  if (absentCharacters.length < 2) {
    return { events: [], conversations: [], characterUpdates: [] };
  }

  // Group by location
  const byLocation = groupCharactersByLocation(absentCharacters);

  const allEvents: WorldEvent[] = [];
  const allConversations: Omit<Conversation, 'id'>[] = [];
  const allUpdates: { characterId: string; newLocationId: string }[] = [];

  for (const [locationId, chars] of byLocation) {
    if (chars.length < 2) continue;

    const location = world.locationClusters.find(c => c.id === locationId);
    const locationName = location?.canonicalName ?? 'an unknown location';

    const depth = determineSimulationDepth(timeSinceLastSimulation, false);

    if (depth === 'skip') continue;

    if (depth === 'full') {
      const { events, conversation, movements } = await runFullSimulation(
        chars,
        locationName,
        timeSinceLastSimulation,
        world
      );
      allEvents.push(...events);
      allConversations.push(conversation);
      allUpdates.push(...movements);

    } else if (depth === 'summary') {
      const event = await generateSummary(chars, locationName, timeSinceLastSimulation, world);
      allEvents.push(event);
    }
  }

  return { events: allEvents, conversations: allConversations, characterUpdates: allUpdates };
}
