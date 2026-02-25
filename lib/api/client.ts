import type { WorldState } from '@/types/world';

const API_BASE = '/api';

export const api = {
  storage: {
    get: (key: string) =>
      fetch(`${API_BASE}/storage?key=${key}`).then(r => r.ok ? r.json() : null),
    set: (key: string, value: unknown) =>
      fetch(`${API_BASE}/storage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      }),
    delete: (key: string) =>
      fetch(`${API_BASE}/storage?key=${key}`, { method: 'DELETE' }),
    list: () =>
      fetch(`${API_BASE}/storage?list=true`).then(r => r.json()),
  },
  simulate: (
    worldState: WorldState,
    playerLocationClusterId: string,
    timeSinceLastSimulation: number,
    modelId: string,
  ) =>
    fetch(`${API_BASE}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worldState,
        playerLocationClusterId,
        timeSinceLastSimulation,
        modelId,
      }),
    }).then(r => r.ok ? r.json() : null),
};
