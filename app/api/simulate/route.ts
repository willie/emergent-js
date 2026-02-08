import { simulateOffscreen } from '@/lib/world/simulation';
import { isValidModelId } from '@/lib/ai/models';
import type { WorldState } from '@/types/world';

export async function POST(req: Request) {
  const { worldState, playerLocationClusterId, timeSinceLastSimulation, modelId } = await req.json() as {
    worldState: WorldState;
    playerLocationClusterId: string;
    timeSinceLastSimulation: number;
    modelId?: string;
  };

  if (modelId && !isValidModelId(modelId)) {
    return Response.json({ error: 'Invalid model ID' }, { status: 400 });
  }

  const result = await simulateOffscreen(
    worldState,
    playerLocationClusterId,
    timeSinceLastSimulation,
    modelId
  );

  return Response.json(result);
}
