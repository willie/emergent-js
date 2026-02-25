import { simulateOffscreen } from '@/lib/world/simulation';
import { isValidModel } from '@/lib/ai/models';
import type { WorldState } from '@/types/world';

export async function POST(req: Request) {
  let worldState: WorldState;
  let playerLocationClusterId: string;
  let timeSinceLastSimulation: number;
  let rawModelId: string | undefined;

  try {
    const json = await req.json();
    worldState = json.worldState;
    playerLocationClusterId = json.playerLocationClusterId;
    timeSinceLastSimulation = json.timeSinceLastSimulation;
    rawModelId = json.modelId;
  } catch (error) {
    console.error("[SIMULATE API] Invalid JSON:", error);
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

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
