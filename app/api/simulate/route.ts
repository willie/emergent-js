import { simulateOffscreen } from '@/lib/world/simulation';
import { isValidModel } from '@/lib/ai/models';
import type { WorldState } from '@/types/world';

export async function POST(req: Request) {
  const { worldState, playerLocationClusterId, timeSinceLastSimulation, modelId: rawModelId } = await req.json() as {
    worldState: WorldState;
    playerLocationClusterId: string;
    timeSinceLastSimulation: number;
    modelId?: string;
  };

  const modelId = rawModelId && isValidModel(rawModelId) ? rawModelId : undefined;

  const result = await simulateOffscreen(
    worldState,
    playerLocationClusterId,
    timeSinceLastSimulation,
    modelId
  );

  return Response.json(result);
}
