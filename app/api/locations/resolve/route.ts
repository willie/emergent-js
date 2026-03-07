import { resolveLocation } from '@/lib/world/locations';
import { isValidModel } from '@/lib/ai/models';
import type { LocationCluster } from '@/types/world';
import { parseSafeJson, handleApiError } from '@/lib/api/request-utils';

export async function POST(req: Request) {
  let description: string;
  let existingClusters: LocationCluster[];
  let rawModelId: string | undefined;

  try {
    const json = await parseSafeJson(req);
    description = json.description;
    existingClusters = json.existingClusters;
    rawModelId = json.modelId;
  } catch (error) {
    return handleApiError(error, 'RESOLVE LOCATION API');
  }

  const modelId = rawModelId && isValidModel(rawModelId) ? rawModelId : undefined;

  const result = await resolveLocation(description, existingClusters, modelId);

  return Response.json(result);
}
