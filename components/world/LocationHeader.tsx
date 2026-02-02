'use client';

import { useWorldStore } from '@/store/world-store';

export function LocationHeader() {
  const world = useWorldStore((s) => s.world);
  const getPlayerCharacter = useWorldStore((s) => s.getPlayerCharacter);
  const getLocationCluster = useWorldStore((s) => s.getLocationCluster);
  const getCharactersAtLocation = useWorldStore((s) => s.getCharactersAtLocation);

  if (!world) return null;

  const player = getPlayerCharacter();
  if (!player) return null;

  const location = getLocationCluster(player.currentLocationClusterId);
  const nearbyCharacters = getCharactersAtLocation(player.currentLocationClusterId).filter(
    (c) => !c.isPlayer
  );

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
