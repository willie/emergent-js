import { resolveLocation } from '@/lib/world/locations';
import { isValidModel } from '@/lib/ai/models';
import type { LocationCluster } from '@/types/world';

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { description, existingClusters, modelId: rawModelId } = body as {
    description: string;
    existingClusters: LocationCluster[];
    modelId?: string;
  };

  const modelId = rawModelId && isValidModel(rawModelId) ? rawModelId : undefined;

  const result = await resolveLocation(description, existingClusters, modelId);

  return Response.json(result);
}
