import { generateText, generateObject } from 'ai';
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
${characters.map(c => `- ${c.name}: ${c.description}`).join('\n')}

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
): Promise<{ events: WorldEvent[]; messages: Message[]; conversation: Omit<Conversation, 'id'> }> {
  const characterNames = characters.map(c => c.name).join(' and ');
  const turnCount = Math.min(Math.ceil(timeElapsed / 2), 8); // Cap at 8 turns

  const systemPrompt = `You are simulating a conversation between ${characterNames} at ${locationName}.

Characters:
${characters.map(c => `- ${c.name}: ${c.description}`).join('\n')}

Scenario: ${world.scenario.description}
Time: ${world.time.narrativeTime}

Write a natural dialogue between these characters. Each character should stay in character.
Format each line as: CHARACTER_NAME: "dialogue"
Include brief action descriptions in *asterisks* when appropriate.

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
        conversationId: '', // Will be set when conversation is created
        role: 'assistant',
        content: content.replace(/^["']|["']$/g, '').trim(),
        timestamp: world.time.tick,
        speakerId: speaker?.id,
      });
    }
  }

  // Extract key events from the conversation
  const eventResult = await generateObject({
    model: openrouter(models.fast),
    schema: z.object({
      events: z.array(z.object({
        description: z.string().describe('Brief description of what happened'),
        isSignificant: z.boolean().describe('Whether this is plot-relevant'),
      })),
    }),
    prompt: `Analyze this conversation and extract any significant events or information exchanges:

${text}

List any important events (agreements made, information shared, conflicts, etc.).
Skip trivial small talk.`,
  });

  const events: WorldEvent[] = eventResult.object.events
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

  return { events, messages, conversation };
}

/**
 * Simulate off-screen interactions between characters.
 * Returns events and any new conversations to add to the world.
 */
export async function simulateOffscreen(
  world: WorldState,
  playerLocationClusterId: string,
  timeSinceLastSimulation: number
): Promise<{
  events: WorldEvent[];
  conversations: Omit<Conversation, 'id'>[];
}> {
  // Get non-player characters not at player's location
  const absentCharacters = world.characters.filter(
    c => !c.isPlayer &&
    c.isDiscovered &&
    c.currentLocationClusterId !== playerLocationClusterId
  );

  if (absentCharacters.length < 2) {
    return { events: [], conversations: [] };
  }

  // Group by location
  const byLocation = groupCharactersByLocation(absentCharacters);

  const allEvents: WorldEvent[] = [];
  const allConversations: Omit<Conversation, 'id'>[] = [];

  for (const [locationId, chars] of byLocation) {
    if (chars.length < 2) continue;

    const location = world.locationClusters.find(c => c.id === locationId);
    const locationName = location?.canonicalName ?? 'an unknown location';

    // Determine simulation depth
    // For now, we'll use time elapsed as the main factor
    const depth = determineSimulationDepth(
      timeSinceLastSimulation,
      false // TODO: track unresolved plot points
    );

    if (depth === 'skip') continue;

    if (depth === 'full') {
      const { events, conversation } = await runFullSimulation(
        chars,
        locationName,
        timeSinceLastSimulation,
        world
      );
      allEvents.push(...events);
      allConversations.push(conversation);
    } else if (depth === 'summary') {
      const event = await generateSummary(chars, locationName, timeSinceLastSimulation, world);
      allEvents.push(event);
    }
  }

  return { events: allEvents, conversations: allConversations };
}

/**
 * Check if simulation should be triggered (e.g., when player returns to a character).
 */
export function shouldSimulate(
  world: WorldState,
  newLocationClusterId: string
): { shouldRun: boolean; timeSinceLastSimulation: number } {
  // Find characters at the new location that the player hasn't been with recently
  const charactersAtNewLocation = world.characters.filter(
    c => !c.isPlayer &&
    c.isDiscovered &&
    c.currentLocationClusterId === newLocationClusterId
  );

  if (charactersAtNewLocation.length === 0) {
    return { shouldRun: false, timeSinceLastSimulation: 0 };
  }

  // Check time since player was last at this location with these characters
  // For now, we'll trigger if time has passed significantly
  const timeSinceLastSimulation = world.time.tick; // Simplified - would track per location

  return {
    shouldRun: timeSinceLastSimulation > 5,
    timeSinceLastSimulation,
  };
}
