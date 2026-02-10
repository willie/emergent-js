"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { useWorldStore } from "@/store/world-store";

interface WorldProviderProps {
  children: ReactNode;
}

function subscribeToHydration(callback: () => void) {
  const unsub = useWorldStore.persist.onFinishHydration(callback);
  return unsub;
}

function getHydrated() {
  return useWorldStore.persist.hasHydrated();
}

function getServerHydrated() {
  return false;
}

export function WorldProvider({ children }: WorldProviderProps) {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydrated,
    getServerHydrated,
  );

  // Show loading only until storage is hydrated.
  // We do NOT block if world is null - that's for the consumer (GameLayout) to handle.
  if (!hydrated) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
