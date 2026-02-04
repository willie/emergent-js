import { resolveLocation } from '@/lib/world/locations';
import type { LocationCluster } from '@/types/world';

export async function POST(req: Request) {
  const { description, existingClusters, modelId } = await req.json() as {
    description: string;
    existingClusters: LocationCluster[];
    modelId?: string;
  };

  const result = await resolveLocation(description, existingClusters, modelId);

  return Response.json(result);
}
