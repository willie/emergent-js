import { resolveLocation } from '@/lib/world/locations';
import { isValidModel } from '@/lib/ai/models';
import type { LocationCluster } from '@/types/world';

export async function POST(req: Request) {
  const { description, existingClusters, modelId: rawModelId } = await req.json() as {
    description: string;
    existingClusters: LocationCluster[];
    modelId?: string;
  };

  const modelId = rawModelId && isValidModel(rawModelId) ? rawModelId : undefined;

  const result = await resolveLocation(description, existingClusters, modelId);

  return Response.json(result);
}
