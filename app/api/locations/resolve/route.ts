import { resolveLocation } from '@/lib/world/locations';
import { isValidModel } from '@/lib/ai/models';
import type { LocationCluster } from '@/types/world';

export async function POST(req: Request) {
  let description: string;
  let existingClusters: LocationCluster[];
  let rawModelId: string | undefined;

  try {
    const json = await req.json();
    description = json.description;
    existingClusters = json.existingClusters;
    rawModelId = json.modelId;
  } catch (error) {
    console.error("[RESOLVE LOCATION API] Invalid JSON:", error);
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const modelId = rawModelId && isValidModel(rawModelId) ? rawModelId : undefined;

  const result = await resolveLocation(description, existingClusters, modelId);

  return Response.json(result);
}
