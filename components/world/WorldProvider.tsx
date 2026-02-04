'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useWorldStore } from '@/store/world-store';

interface WorldProviderProps {
  children: ReactNode;
}

export function WorldProvider({ children }: WorldProviderProps) {
  const [mounted, setMounted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (useWorldStore.persist.hasHydrated()) {
      setHydrated(true);
    } else {
      useWorldStore.persist.onFinishHydration(() => setHydrated(true));
    }
  }, []);

  // Show loading only until storage is hydrated. 
  // We do NOT block if world is null - that's for the consumer (GameLayout) to handle.
  if (!mounted || !hydrated) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
