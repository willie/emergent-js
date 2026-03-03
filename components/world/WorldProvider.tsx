"use client";

import { useSyncExternalStore, useEffect, useRef, type ReactNode } from "react";
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

  // Run deduplication once after hydration to clean up existing saves
  const dedupRan = useRef(false);
  useEffect(() => {
    if (hydrated && !dedupRan.current) {
      dedupRan.current = true;
      const store = useWorldStore.getState();
      store.deduplicateLocationClusters();
      store.deduplicateEvents();
      store.deduplicateConversations();
    }
  }, [hydrated]);

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
