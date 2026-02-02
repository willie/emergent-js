import { simulateOffscreen } from '@/lib/world/simulation';
import type { WorldState } from '@/types/world';

export async function POST(req: Request) {
  const { worldState, playerLocationClusterId, timeSinceLastSimulation } = await req.json() as {
    worldState: WorldState;
    playerLocationClusterId: string;
    timeSinceLastSimulation: number;
  };

  const result = await simulateOffscreen(
    worldState,
    playerLocationClusterId,
    timeSinceLastSimulation
  );

  return Response.json(result);
}
