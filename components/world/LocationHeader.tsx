'use client';

import { useWorldStore } from '@/store/world-store';

export function LocationHeader() {
  const player = useWorldStore((s) =>
    s.world?.characters.find(c => c.id === s.world?.playerCharacterId)
  );

  const characters = useWorldStore((s) => s.world?.characters ?? []);

  const location = useWorldStore((s) =>
    s.world?.locationClusters.find(c => c.id === player?.currentLocationClusterId)
  );

  const nearbyCharacters = characters.filter(c =>
    c.currentLocationClusterId === player?.currentLocationClusterId &&
    c.isDiscovered &&
    !c.isPlayer
  );

  if (!player) return null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-zinc-500">Location:</span>
        <span className="font-medium text-zinc-100">
          {location?.canonicalName ?? 'Unknown'}
        </span>
      </div>
      {nearbyCharacters.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Present:</span>
          <span className="text-zinc-300">
            {nearbyCharacters.map((c) => c.name).join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}
