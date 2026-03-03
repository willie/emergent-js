'use client';

import { useWorldStore } from '@/store/world-store';

export function WorldClock() {
  const time = useWorldStore((s) => s.world?.time);

  if (!time) return null;

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-zinc-500">Time:</span>
        <span className="text-zinc-300">{time.narrativeTime}</span>
      </div>
      <div className="text-zinc-600">
        tick {time.tick}
      </div>
    </div>
  );
}
