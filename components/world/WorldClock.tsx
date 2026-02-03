'use client';

import { useWorldStore } from '@/store/world-store';

export function WorldClock() {
  const world = useWorldStore((s) => s.world);

  if (!world) return null;

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-zinc-500">Time:</span>
        <span className="text-zinc-300">{world.time.narrativeTime}</span>
      </div>
      <div className="text-zinc-600">
        tick {world.time.tick}
      </div>
    </div>
  );
}
