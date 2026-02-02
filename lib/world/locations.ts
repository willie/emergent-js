import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter, models } from '@/lib/ai/openrouter';
import type { LocationCluster } from '@/types/world';

const LocationMatchSchema = z.object({
  matchedClusterId: z.string().nullable().describe('ID of matching cluster, or null if new location'),
  canonicalName: z.string().describe('Short canonical name for this location (e.g., "Kitchen", "Back Alley")'),
  confidence: z.number().min(0).max(1).describe('Confidence that this is the same location (0-1)'),
});

/**
 * Resolve a location description to an existing cluster or create a new one.
 * Uses LLM to understand semantic similarity between location descriptions.
 */
export async function resolveLocation(
  description: string,
  existingClusters: LocationCluster[],
  similarityThreshold = 0.7
): Promise<{
  clusterId: string | null;
  canonicalName: string;
  isNew: boolean;
}> {
  if (existingClusters.length === 0) {
    // No existing clusters, generate canonical name for new location
    const result = await generateObject({
      model: openrouter(models.fast),
      schema: z.object({
        canonicalName: z.string().describe('Short canonical name for this location'),
      }),
      prompt: `Extract a short, canonical location name from this description. Return only a brief name (1-3 words).

Description: "${description}"

Examples:
- "the old kitchen in the back" -> "Kitchen"
- "my cramped bedroom upstairs" -> "Upstairs Bedroom"
- "a dimly lit alley behind the bar" -> "Back Alley"
- "the main street of the small town" -> "Main Street"`,
    });

    return {
      clusterId: null,
      canonicalName: result.object.canonicalName,
      isNew: true,
    };
  }

  // Ask LLM to match against existing clusters
  const clusterList = existingClusters
    .map((c) => `- ID: "${c.id}", Name: "${c.canonicalName}"`)
    .join('\n');

  const result = await generateObject({
    model: openrouter(models.fast),
    schema: LocationMatchSchema,
    prompt: `Determine if this location description matches any existing location, or is a new place.

New location description: "${description}"

Existing locations:
${clusterList}

Rules:
- Match if they refer to the same physical place (e.g., "the kitchen" and "my kitchen" are the same)
- Don't match if they're different places (e.g., "the kitchen" and "the bedroom" are different)
- Consider context clues (e.g., "upstairs bedroom" vs "downstairs bedroom" are different)
- If no match, provide a canonical name for this new location

Set matchedClusterId to the ID if it matches an existing location, or null if it's new.
Set confidence to how sure you are (0.0-1.0) that this is the same place.`,
  });

  const { matchedClusterId, canonicalName, confidence } = result.object;

  if (matchedClusterId && confidence >= similarityThreshold) {
    return {
      clusterId: matchedClusterId,
      canonicalName: existingClusters.find((c) => c.id === matchedClusterId)?.canonicalName ?? canonicalName,
      isNew: false,
    };
  }

  return {
    clusterId: null,
    canonicalName,
    isNew: true,
  };
}

/**
 * Extract location from narrative text.
 * Returns null if no location change is detected.
 */
export async function extractLocationFromText(
  text: string,
  currentLocation: string
): Promise<{ newLocation: string; isMovement: boolean } | null> {
  const result = await generateObject({
    model: openrouter(models.fast),
    schema: z.object({
      hasMovement: z.boolean().describe('Whether the text indicates movement to a new location'),
      newLocation: z.string().nullable().describe('Description of the new location, or null if no movement'),
    }),
    prompt: `Analyze this text for location changes.

Current location: "${currentLocation}"
Text: "${text}"

Does this text indicate the character is moving to or arriving at a different location?
If yes, describe the new location. If no movement, set hasMovement to false.

Examples of movement:
- "I walk to the kitchen" -> hasMovement: true, newLocation: "the kitchen"
- "Let's go outside" -> hasMovement: true, newLocation: "outside"
- "I head back to my apartment" -> hasMovement: true, newLocation: "apartment"

Examples of no movement:
- "I look around the room" -> hasMovement: false
- "What do you think about that?" -> hasMovement: false
- "I pick up the book" -> hasMovement: false`,
  });

  if (result.object.hasMovement && result.object.newLocation) {
    return {
      newLocation: result.object.newLocation,
      isMovement: true,
    };
  }

  return null;
}
