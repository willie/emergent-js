import { resolveLocation } from '@/lib/world/locations';
import type { LocationCluster } from '@/types/world';

export async function POST(req: Request) {
  const { description, existingClusters } = await req.json() as {
    description: string;
    existingClusters: LocationCluster[];
  };

  const result = await resolveLocation(description, existingClusters);

  return Response.json(result);
}
