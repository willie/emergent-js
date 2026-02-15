"use client";

import { useRef, useMemo } from "react";
import { useWorldStore } from "@/store/world-store";
import { useSettingsStore } from "@/store/settings-store";
import type { WorldActions } from "@/lib/chat/tool-processor";
import { createGameEngine, type GameEngine } from "@/lib/game/engine";

interface UseGameEngineOptions {
  processedTools: React.MutableRefObject<Set<string>>;
  markToolProcessed: (key: string) => void;
  initialTick: number;
}

export function useGameEngine(options: UseGameEngineOptions): {
  engine: GameEngine;
  lastSimulationTick: React.MutableRefObject<number>;
} {
  const { processedTools, markToolProcessed, initialTick } = options;

  // Store actions — stable references from Zustand
  const advanceTime = useWorldStore((s) => s.advanceTime);
  const addLocationCluster = useWorldStore((s) => s.addLocationCluster);
  const moveCharacter = useWorldStore((s) => s.moveCharacter);
  const discoverCharacter = useWorldStore((s) => s.discoverCharacter);
  const addEvent = useWorldStore((s) => s.addEvent);
  const addConversation = useWorldStore((s) => s.addConversation);
  const updateCharacterKnowledge = useWorldStore(
    (s) => s.updateCharacterKnowledge,
  );
  const setSimulating = useWorldStore((s) => s.setSimulating);
  const addCharacter = useWorldStore((s) => s.addCharacter);

  const lastSimulationTick = useRef(initialTick);

  // Build WorldActions adapter
  const worldActions: WorldActions = useMemo(
    () => ({
      advanceTime,
      addLocationCluster,
      moveCharacter,
      discoverCharacter,
      addEvent,
      addConversation,
      updateCharacterKnowledge: (characterId: string, knowledge: { content: string; acquiredAt: number; source: "witnessed" | "told" | "inferred" }) =>
        updateCharacterKnowledge(characterId, knowledge),
      setSimulating,
      addCharacter,
      getWorld: () => useWorldStore.getState().world,
      removeCharactersByCreatorMessageId: useWorldStore.getState().removeCharactersByCreatorMessageId,
      removeEventsBySourceId: useWorldStore.getState().removeEventsBySourceId,
    }),
    [
      advanceTime,
      addLocationCluster,
      moveCharacter,
      discoverCharacter,
      addEvent,
      addConversation,
      updateCharacterKnowledge,
      setSimulating,
      addCharacter,
    ],
  );

  const engine = useMemo(
    () =>
      createGameEngine({
        worldActions,
        getModelId: () => useSettingsStore.getState().modelId,
        processedTools: processedTools.current,
        onToolProcessed: markToolProcessed,
        lastSimulationTick,
      }),
    [worldActions, processedTools, markToolProcessed],
  );

  return { engine, lastSimulationTick };
}
