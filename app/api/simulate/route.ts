import { simulateOffscreen } from '@/lib/world/simulation';
import { isValidModel } from '@/lib/ai/models';
import type { WorldState } from '@/types/world';

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { worldState, playerLocationClusterId, timeSinceLastSimulation, modelId: rawModelId } = body as {
    worldState: WorldState;
    playerLocationClusterId: string;
    timeSinceLastSimulation: number;
    modelId?: string;
  };

  const modelId = rawModelId && isValidModel(rawModelId) ? rawModelId : undefined;

  // Filter for recent relevant events (last 10 events)
  // We want events that are global (no involved characters?) or involve the characters we might simulate
  // But we don't know exactly who we are simulating yet (simulateOffscreen decides).
  // Strategy: Just pass the last 10-15 global/significant events.
  const relevantEvents = worldState.events
    .sort((a, b) => b.timestamp - a.timestamp) // Newest first
    .slice(0, 15) // Take last 15
    .reverse(); // Back to chronological

  const result = await simulateOffscreen(
    worldState,
    playerLocationClusterId,
    timeSinceLastSimulation,
    modelId,
    relevantEvents
  );

  return Response.json(result);
}
