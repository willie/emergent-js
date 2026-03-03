'use client';

import { useWorldStore } from '@/store/world-store';

export function LocationHeader({
  topRight,
  bottomRight
}: {
  topRight?: React.ReactNode;
  bottomRight?: React.ReactNode;
}) {
  const world = useWorldStore((s) => s.world);

  if (!world) return null;

  const player = world.characters.find(c => c.id === world.playerCharacterId);
  const loc = world.locationClusters.find(c => c.id === player?.currentLocationClusterId);
  const locationName = loc?.canonicalName ?? 'Unknown';
  const nearbyCharacters = world.characters
    .filter(c => c.currentLocationClusterId === player?.currentLocationClusterId && c.isDiscovered && !c.isPlayer);

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
