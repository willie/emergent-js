'use client';

import { useWorldStore } from '@/store/world-store';

export function LocationHeader({
  topRight,
  bottomRight
}: {
  topRight?: React.ReactNode;
  bottomRight?: React.ReactNode;
}) {
  const { locationName, nearbyCharacters } = useWorldStore((s) => {
    if (!s.world) return { locationName: null, nearbyCharacters: [] as { id: string; name: string }[] };
    const player = s.world.characters.find(c => c.id === s.world!.playerCharacterId);
    const loc = s.world.locationClusters.find(c => c.id === player?.currentLocationClusterId);
    const nearby = s.world.characters
      .filter(c => c.currentLocationClusterId === player?.currentLocationClusterId && c.isDiscovered && !c.isPlayer)
      .map(c => ({ id: c.id, name: c.name }));
    return { locationName: loc?.canonicalName ?? 'Unknown', nearbyCharacters: nearby };
  });

  if (!locationName) return null;

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center justify-between text-sm min-h-[1.5rem]">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">Location:</span>
          <span className="font-medium text-zinc-100">
            {locationName}
          </span>
        </div>
        {topRight && (
          <div className="shrink-0">
            {topRight}
          </div>
        )}
      </div>
      {(nearbyCharacters.length > 0 || bottomRight) && (
        <div className="flex items-center justify-between text-sm min-h-[1.5rem]">
          <div className="flex items-center gap-2">
            {nearbyCharacters.length > 0 && (
              <>
                <span className="text-zinc-500">Present:</span>
                <span className="text-zinc-300">
                  {nearbyCharacters.map((c) => c.name).join(', ')}
                </span>
              </>
            )}
          </div>
          {bottomRight && (
            <div className="shrink-0 ml-auto pl-4">
              {bottomRight}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
