import { generateText, tool } from 'ai';
import { z } from 'zod';
import { openrouter, models } from '@/lib/ai/openrouter';
import type { LocationCluster } from '@/types/world';

/**
 * Resolve a location description to an existing cluster or create a new one.
 * Uses LLM tool calling to semantically match locations.
 */
export async function resolveLocation(
  description: string,
  existingClusters: LocationCluster[],
  modelId?: string
): Promise<{
  clusterId: string | null;
  canonicalName: string;
  isNew: boolean;
}> {
  // If no existing clusters, just extract a canonical name
  if (existingClusters.length === 0) {
    return {
      clusterId: null,
      canonicalName: extractCanonicalName(description),
      isNew: true,
    };
  }

  const clusterList = existingClusters
    .map((c, i) => `${i + 1}. "${c.canonicalName}" (id: ${c.id})`)
    .join('\n');

  const result = await generateText({
    model: openrouter(modelId || models.fast),
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
    toolChoice: 'required',
    prompt: `Given this location description: "${description}"

And these existing locations:
${clusterList}

Determine if the description refers to one of the existing locations or is a new location.
Consider semantic similarity - "the cafe" matches "Coffee Shop", "town center" matches "Town Square", etc.

Call the resolveLocation tool with:
- matchedClusterId: the id of the matching location, or null if it's a new place
- canonicalName: the best canonical name for this location
- confidence: how confident you are in the match (0.0-1.0)`,
  });

  const toolCall = result.toolCalls[0];
  const input = toolCall?.input;

  if (!toolCall || toolCall.toolName !== 'resolveLocation' || !input) {
    // Fallback to simple extraction if tool calling fails
    return {
      clusterId: null,
      canonicalName: extractCanonicalName(description),
      isNew: true,
    };
  }

  const { matchedClusterId, canonicalName, confidence } = input as { matchedClusterId: string | null; canonicalName: string; confidence: number };
  const similarityThreshold = 0.6;

  if (matchedClusterId && confidence >= similarityThreshold) {
    const cluster = existingClusters.find(c => c.id === matchedClusterId);
    return {
      clusterId: matchedClusterId,
      canonicalName: cluster?.canonicalName ?? canonicalName,
      isNew: false,
    };
  }

  return {
    clusterId: null,
    canonicalName: canonicalName || extractCanonicalName(description),
    isNew: true,
  };
}

/**
 * Extract a short canonical name from a location description.
 */
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
