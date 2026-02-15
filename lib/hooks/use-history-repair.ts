"use client";

import { useRef, useEffect } from "react";
import type { UIMessage } from "@ai-sdk/react";
import type { WorldState } from "@/types/world";

interface UseHistoryRepairOptions {
  messages: UIMessage[];
  world: WorldState | null;
  isHydrated: boolean;
  processedTools: React.MutableRefObject<Set<string>>;
  markToolProcessed: (key: string) => void;
  deduplicateEvents: () => void;
  deduplicateConversations: () => void;
}

export function useHistoryRepair(options: UseHistoryRepairOptions): void {
  const {
    messages,
    world,
    isHydrated,
    processedTools,
    markToolProcessed,
    deduplicateEvents,
    deduplicateConversations,
  } = options;

  const hasRepairedHistory = useRef(false);

  useEffect(() => {
    if (!isHydrated || !world || hasRepairedHistory.current) return;

    if (
      messages.length > 0 &&
      (world.time.tick > 0 || processedTools.current.size > 0)
    ) {
      hasRepairedHistory.current = true;

      console.log("[HISTORY REPAIR] Running history repair and healing...");

      // 1. Heal processed tools
      if (processedTools.current.size === 0) {
        console.log("[HISTORY REPAIR] Healing processed tools history...");
        messages.forEach((m) => {
          if (m.role !== "assistant") return;

          if ((m as any).toolInvocations) {
            (m as any).toolInvocations.forEach((t: any) => {
              if (t.state === "result") {
                markToolProcessed(`${m.id}-${t.toolCallId}`);
              }
            });
          }

          m.parts.forEach((p) => {
            if (
              p.type === "tool-result" ||
              (p.type.startsWith("tool-") &&
                (p as any).state === "output-available")
            ) {
              const callId = (p as any).toolCallId || `${m.id}-${p.type}`;
              markToolProcessed(`${m.id}-${callId}`);
            }
          });
        });
      }

      // 2. Deduplicate events
      deduplicateEvents();

      // 3. Deduplicate conversations
      deduplicateConversations();

      // 4. Location drift detection (log-only)
      let lastMovementAction: {
        destination: string;
        toolCallId: string;
      } | null = null;

      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.role !== "assistant") continue;

        if ((m as any).toolInvocations) {
          for (const t of (m as any).toolInvocations) {
            if (t.state === "result" && t.result?.type === "movement") {
              lastMovementAction = {
                destination: t.result.destination,
                toolCallId: t.toolCallId,
              };
              break;
            }
          }
        }
        if (lastMovementAction) break;

        for (const p of m.parts) {
          if (
            p.type === "tool-result" &&
            (p as any).result?.type === "movement"
          ) {
            lastMovementAction = {
              destination: (p as any).result.destination,
              toolCallId: (p as any).toolCallId,
            };
            break;
          }
          if (
            p.type.startsWith("tool-") &&
            (p as any).state === "output-available" &&
            (p as any).output?.type === "movement"
          ) {
            lastMovementAction = {
              destination: (p as any).output.destination,
              toolCallId: (p as any).toolCallId || `${m.id}-${p.type}`,
            };
            break;
          }
        }
        if (lastMovementAction) break;
      }

      // Log-only: auto-moving is too risky without an API call
      if (lastMovementAction) {
        const player = world.characters.find(
          (c) => c.id === world.playerCharacterId,
        );
        const currentLocation = world.locationClusters.find(
          (l) => l.id === player?.currentLocationClusterId,
        );
        if (currentLocation) {
          console.log(
            `[HISTORY REPAIR] Last movement to: "${lastMovementAction.destination}", current: "${currentLocation.canonicalName}"`,
          );
        }
      }
    }
  }, [
    isHydrated,
    messages,
    world?.time.tick,
    markToolProcessed,
    processedTools,
    deduplicateEvents,
    deduplicateConversations,
    world,
  ]);
}
