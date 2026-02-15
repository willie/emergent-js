import type { UIMessage } from "@ai-sdk/react";
import {
  processToolResult,
  type ToolResult,
  type WorldActions,
} from "@/lib/chat/tool-processor";
import {
  type MessageWithToolInvocations,
  isToolResultPart,
  isDynamicToolPart,
  isToolResult,
} from "./types";
import type { ActionResult } from "./action-executor";

// ── Config ───────────────────────────────────────────────────────────────────

export interface GameEngineConfig {
  worldActions: WorldActions;
  getModelId: () => string;
  processedTools: Set<string>;
  onToolProcessed: (key: string) => void;
  lastSimulationTick: { current: number };
}

// ── Engine ───────────────────────────────────────────────────────────────────

export function createGameEngine(config: GameEngineConfig) {
  const {
    worldActions,
    getModelId,
    processedTools,
    onToolProcessed,
    lastSimulationTick,
  } = config;

  /** Process a single tool result through the tool-processor pipeline. */
  async function handleToolResult(
    result: ToolResult,
    messageId: string,
    toolCallId: string,
  ): Promise<void> {
    await processToolResult(result, messageId, toolCallId, {
      processedTools,
      onToolProcessed,
      worldActions,
      getModelId,
      lastSimulationTick,
    });
  }

  /**
   * Scan all messages for unprocessed tool results and process them.
   * Called as an effect whenever the message list changes.
   */
  function scanAndProcessToolResults(messages: UIMessage[]): void {
    for (const message of messages) {
      if (message.role !== "assistant") continue;

      // Check toolInvocations (common in useChat)
      const msgWithTools = message as MessageWithToolInvocations;
      if (msgWithTools.toolInvocations) {
        for (const tool of msgWithTools.toolInvocations) {
          if (tool.state === "result" && isToolResult(tool.result)) {
            handleToolResult(tool.result, message.id, tool.toolCallId);
          }
        }
      }

      // Check explicit parts (V6 style & custom stream formats)
      for (const part of message.parts) {
        if (isToolResultPart(part) && isToolResult(part.result)) {
          handleToolResult(part.result, message.id, part.toolCallId);
        } else if (
          isDynamicToolPart(part) &&
          part.state === "output-available" &&
          isToolResult(part.output)
        ) {
          const callId = part.toolCallId || `${message.id}-${part.type}`;
          handleToolResult(part.output, message.id, callId);
        }
      }
    }
  }

  /**
   * Prepare for regeneration of the last assistant message.
   * Clears processed tools, removes created characters/events, reverts time.
   * Returns the time cost that was reverted so the caller can adjust refs.
   */
  function prepareRegeneration(
    lastAssistant: UIMessage,
  ): { timeCostReverted: number } {
    // Clear processed tool results for the assistant message
    for (const part of lastAssistant.parts) {
      if (part.type.startsWith("tool-")) {
        processedTools.delete(`${lastAssistant.id}-${part.type}`);
      }
    }

    // Remove characters and events created by this message
    worldActions.removeCharactersByCreatorMessageId(lastAssistant.id);
    worldActions.removeEventsBySourceId(lastAssistant.id);

    // Calculate time cost to revert
    let timeCostToRevert = 0;

    const checkToolResult = (result: any) => {
      if (result && typeof result === "object") {
        if (result.type === "movement" || result.type === "time_advance") {
          if (typeof result.timeCost === "number") {
            timeCostToRevert += result.timeCost;
          }
        }
      }
    };

    if ((lastAssistant as any).toolInvocations) {
      (lastAssistant as any).toolInvocations.forEach((t: any) => {
        if (t.state === "result") checkToolResult(t.result);
      });
    }

    lastAssistant.parts.forEach((p) => {
      if (p.type === "tool-result") {
        checkToolResult((p as any).result);
      } else if (
        p.type.startsWith("tool-") &&
        (p as any).state === "output-available"
      ) {
        checkToolResult((p as any).output);
      }
    });

    // Also check action_results annotations (server-side execution format)
    const annotations = (lastAssistant as any).annotations;
    if (annotations && Array.isArray(annotations)) {
      for (const annotation of annotations) {
        if (
          annotation?.type === "action_results" &&
          Array.isArray(annotation.results)
        ) {
          for (const result of annotation.results) {
            checkToolResult(result);
          }
        }
      }
    }

    // Clear the action-results dedup key so it can be re-processed after regeneration
    processedTools.delete(`action-results-${lastAssistant.id}`);

    if (timeCostToRevert > 0) {
      console.log(
        `[ENGINE] Reverting time by ${timeCostToRevert} ticks for regeneration`,
      );
      worldActions.advanceTime(-timeCostToRevert);
    }

    return { timeCostReverted: timeCostToRevert };
  }

  /**
   * Apply server-side action results to the client-side world store.
   * Called when the chat stream includes action_results annotations.
   */
  function applyActionResults(
    results: ActionResult[],
    messageId: string,
  ): void {
    const currentWorld = worldActions.getWorld();
    if (!currentWorld) return;

    // Dedup key to prevent double-processing
    const dedupeKey = `action-results-${messageId}`;
    if (processedTools.has(dedupeKey)) return;
    onToolProcessed(dedupeKey);

    for (const result of results) {
      if (result.type === "movement") {
        let clusterId = result.clusterId;
        if (result.resolvedCluster.isNew) {
          const newCluster = worldActions.addLocationCluster({
            canonicalName: result.resolvedCluster.canonicalName,
            centroidEmbedding: [],
          });
          clusterId = newCluster.id;
        }

        if (clusterId) {
          worldActions.moveCharacter(
            currentWorld.playerCharacterId,
            clusterId,
          );

          if (result.accompaniedBy) {
            for (const name of result.accompaniedBy) {
              const match = currentWorld.characters.find(
                (c) =>
                  c.name.toLowerCase() === name.toLowerCase() &&
                  c.id !== currentWorld.playerCharacterId,
              );
              if (match) {
                worldActions.moveCharacter(match.id, clusterId);
              }
            }
          }
        }

        // Apply simulation results
        if (result.simulation) {
          const { events, conversations, characterUpdates } =
            result.simulation;
          for (const event of events) {
            worldActions.addEvent({
              ...event,
              sourceMessageId: messageId,
            });
          }
          for (const conv of conversations) {
            worldActions.addConversation(conv);
          }
          for (const update of characterUpdates) {
            worldActions.moveCharacter(
              update.characterId,
              update.newLocationId,
            );
          }
          lastSimulationTick.current = currentWorld.time.tick;
        }

        worldActions.advanceTime(
          result.timeCost ?? 5,
          result.narrativeTime,
        );
      } else if (result.type === "time_advance") {
        worldActions.advanceTime(
          result.timeCost ?? 5,
          result.narrativeTime,
        );
      } else if (result.type === "character_discovery") {
        if (result.discoveredCharacterId) {
          worldActions.discoverCharacter(result.discoveredCharacterId);
        } else if (result.newCharacter) {
          worldActions.addCharacter({
            ...result.newCharacter,
            createdByMessageId: messageId,
          });
        }
      }
    }
  }

  return {
    handleToolResult,
    scanAndProcessToolResults,
    prepareRegeneration,
    applyActionResults,
  };
}

export type GameEngine = ReturnType<typeof createGameEngine>;
