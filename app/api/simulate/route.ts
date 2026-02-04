import { simulateOffscreen } from '@/lib/world/simulation';
import type { WorldState } from '@/types/world';

export async function POST(req: Request) {
  const { worldState, playerLocationClusterId, timeSinceLastSimulation, modelId } = await req.json() as {
    worldState: WorldState;
    playerLocationClusterId: string;
    timeSinceLastSimulation: number;
    modelId?: string;
  };

  const result = await simulateOffscreen(
    worldState,
    playerLocationClusterId,
    timeSinceLastSimulation,
    modelId
  );

  return Response.json(result);
}
