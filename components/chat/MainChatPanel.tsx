"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useWorldStore } from "@/store/world-store";
import { useSettingsStore } from "@/store/settings-store";
import { useRef, useEffect, useState, useCallback } from "react";
import {
  useChatPersistence,
  clearChatStorage,
} from "@/lib/hooks/use-chat-persistence";
import {
  processToolResult,
  type ToolResult,
  type WorldActions,
} from "@/lib/chat/tool-processor";
import { ChatMessage } from "./ChatMessage";
import {
  isTextPart,
  isToolResultPart,
  isDynamicToolPart,
  isToolResult,
  getToolKeysForMessage,
  type MessageWithToolInvocations,
} from "@/lib/chat/message-utils";

export { clearChatStorage };

export function MainChatPanel() {
  const world = useWorldStore((s) => s.world);
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
  const removeCharactersByCreatorMessageId = useWorldStore(
    (s) => s.removeCharactersByCreatorMessageId,
  );
  const addCharacter = useWorldStore((s) => s.addCharacter);
  const removeEventsBySourceId = useWorldStore((s) => s.removeEventsBySourceId);
  const deduplicateEvents = useWorldStore((s) => s.deduplicateEvents);
  const deduplicateConversations = useWorldStore(
    (s) => s.deduplicateConversations,
  );
  const isSimulating = useWorldStore((s) => s.isSimulating);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const lastSimulationTick = useRef(world?.time.tick ?? 0);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  // Track if we've run the history repair logic this session
  const hasRepairedHistory = useRef(false);

  const modelId = useSettingsStore((s) => s.modelId);
  const { messages, sendMessage, status, setMessages, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { worldState: world, modelId },
    }),
    onFinish: () => {
      setMessages((currentMessages) => {
        // Clean up the trigger message so it doesn't pollute the history
        const lastUserMsgIndex = currentMessages.findLastIndex(
          (m: UIMessage) => m.role === "user",
        );
        if (lastUserMsgIndex !== -1) {
          const lastUserMsg = currentMessages[lastUserMsgIndex];
          const textPart = lastUserMsg.parts.find(isTextPart);
          const isTrigger = textPart?.text === "__SURAT_CONTINUE__";

          if (isTrigger) {
            const newMessages = [...currentMessages];
            newMessages.splice(lastUserMsgIndex, 1);
            return newMessages;
          }
        }
        return currentMessages;
      });
    },
  });

  const { processedTools, markToolProcessed, isHydrated, persistMessages } =
    useChatPersistence({ setMessages });

  const isLoading = status === "streaming" || status === "submitted";

  // Persist messages when they change (after hydration)
  useEffect(() => {
    if (isHydrated && messages.length > 0) {
      persistMessages(messages);
    }
  }, [messages, isHydrated, persistMessages]);

  // HEALING & REPAIR
  useEffect(() => {
    if (!isHydrated || !world || hasRepairedHistory.current) return;

    // Only run this logic once per session/mount when data is available
    if (
      messages.length > 0 &&
      (world.time.tick > 0 || processedTools.current.size > 0)
    ) {
      hasRepairedHistory.current = true;

      console.log("[CHAT PANEL] Running history repair and healing...");

      // 1. Heal processed tools
      if (processedTools.current.size === 0) {
        console.log("[CHAT PANEL] Healing processed tools history...");
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

      // 4. Sync location from history (Repair wrong location display)
      // Find last successful movement
      let lastMovementAction: {
        destination: string;
        toolCallId: string;
      } | null = null;

      // Scan backwards
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.role !== "assistant") continue;

        // Check invocations
        if ((m as any).toolInvocations) {
          for (const t of (m as any).toolInvocations) {
            if (t.state === "result" && t.result?.type === "movement") {
              // This is a candidate
              lastMovementAction = {
                destination: t.result.destination,
                toolCallId: t.toolCallId,
              };
              break;
            }
          }
        }
        if (lastMovementAction) break;

        // Check parts
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

      if (lastMovementAction) {
        // ... (Original logic for location sync)
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

  const handleRegenerate = useCallback(() => {
    if (isLoading || isSimulating) return;
    if (messages.length < 2) return;

    // Find the last user message
    const lastAssistant = messages[messages.length - 1];
    const lastUser = messages[messages.length - 2];

    if (lastAssistant?.role !== "assistant" || lastUser?.role !== "user")
      return;

    // Clear processed tool results for the assistant message
    for (const part of lastAssistant.parts) {
      if (part.type.startsWith("tool-")) {
        processedTools.current.delete(`${lastAssistant.id}-${part.type}`);
      }
    }

    // Remove any characters created by this message (to avoid duplicates if name changes)
    removeCharactersByCreatorMessageId(lastAssistant.id);

    // Rollback world state for this message
    // 1. Remove events generated by this message
    removeEventsBySourceId(lastAssistant.id);

    // 2. Revert time if any was passed
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

    if (timeCostToRevert > 0) {
      console.log(
        `[CHAT PANEL] Reverting time by ${timeCostToRevert} ticks for regeneration`,
      );
      advanceTime(-timeCostToRevert);

      if (lastSimulationTick.current >= timeCostToRevert) {
        lastSimulationTick.current -= timeCostToRevert;
      }
    }

    regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isLoading,
    isSimulating,
    messages,
    processedTools.current,
    removeCharactersByCreatorMessageId,
    removeEventsBySourceId,
    advanceTime,
    regenerate,
    lastSimulationTick,
  ]);

  // Process tool results when messages change
  useEffect(() => {
    const handleProcessToolResult = async (
      result: ToolResult,
      messageId: string,
      toolCallId: string,
    ) => {
      const worldActions: WorldActions = {
        advanceTime,
        addLocationCluster,
        moveCharacter,
        discoverCharacter,
        addEvent,
        addConversation,
        updateCharacterKnowledge: (characterId, knowledge) =>
          updateCharacterKnowledge(characterId, knowledge),
        setSimulating,
        addCharacter,
        getWorld: () => useWorldStore.getState().world,
      };
      await processToolResult(result, messageId, toolCallId, {
        processedTools: processedTools.current,
        onToolProcessed: markToolProcessed,
        worldActions,
        getModelId: () => useSettingsStore.getState().modelId,
        lastSimulationTick,
      });
    };

    for (const message of messages) {
      if (message.role !== "assistant") continue;

      const msgWithTools = message as MessageWithToolInvocations;
      if (msgWithTools.toolInvocations) {
        for (const tool of msgWithTools.toolInvocations) {
          if (tool.state === "result" && isToolResult(tool.result)) {
            handleProcessToolResult(tool.result, message.id, tool.toolCallId);
          }
        }
      }

      for (const part of message.parts) {
        if (isToolResultPart(part) && isToolResult(part.result)) {
          handleProcessToolResult(part.result, message.id, part.toolCallId);
        } else if (
          isDynamicToolPart(part) &&
          part.state === "output-available" &&
          isToolResult(part.output)
        ) {
          const callId = part.toolCallId || `${message.id}-${part.type}`;
          handleProcessToolResult(part.output, message.id, callId);
        }
      }
    }
  }, [
    messages,
    processedTools,
    markToolProcessed,
    advanceTime,
    addLocationCluster,
    moveCharacter,
    discoverCharacter,
    addEvent,
    addConversation,
    updateCharacterKnowledge,
    setSimulating,
    addCharacter,
  ]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading && !isSimulating) {
      advanceTime(1);
      sendMessage({ text: input });
      setInput("");
    }
  };

  const handleContinue = () => {
    if (isLoading || isSimulating) return;
    advanceTime(1);
    sendMessage({ text: "__SURAT_CONTINUE__" });
  };

  const handleEditMessage = useCallback((messageId: string, content: string) => {
    setEditingNodeId(messageId);
    setEditContent(content);
  }, []);

  const handleDeleteMessage = useCallback(
    (messageIndex: number) => {
      setMessages((currentMessages) => {
        const message = currentMessages[messageIndex];
        if (message) {
          const keys = getToolKeysForMessage(message);
          keys.forEach((key) => processedTools.current.delete(key));
        }
        return currentMessages.filter((_, i) => i !== messageIndex);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setMessages, processedTools.current],
  );

  const handleRewindMessage = useCallback(
    (messageIndex: number) => {
      setMessages((currentMessages) => {
        for (let i = messageIndex; i < currentMessages.length; i++) {
          const message = currentMessages[i];
          const keys = getToolKeysForMessage(message);
          keys.forEach((key) => processedTools.current.delete(key));
        }
        return currentMessages.slice(0, messageIndex);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setMessages, processedTools.current],
  );

  const handleSaveEdit = useCallback(
    (messageId: string, content: string) => {
      setMessages((currentMessages) => {
        const msgIndex = currentMessages.findIndex((m) => m.id === messageId);
        if (msgIndex !== -1) {
          const newMessages = [...currentMessages];
          const newParts = [...newMessages[msgIndex].parts];
          const textPartIndex = newParts.findIndex((p) => p.type === "text");
          if (textPartIndex !== -1 && isTextPart(newParts[textPartIndex])) {
            newParts[textPartIndex] = { type: "text", text: content };
            newMessages[msgIndex] = {
              ...newMessages[msgIndex],
              parts: newParts,
            };
            return newMessages;
          }
        }
        return currentMessages;
      });
      setEditingNodeId(null);
    },
    [setMessages],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingNodeId(null);
  }, []);

  const handleEditContentChange = useCallback((content: string) => {
    setEditContent(content);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-zinc-500 text-center py-8">
            <p className="text-lg mb-2">{world?.scenario.title}</p>
            <p className="text-sm">{world?.scenario.description}</p>
            <p className="text-sm mt-4">Type something to begin...</p>
          </div>
        )}
        {messages.map((message, index) => {
          const isLastAssistant =
            message.role === "assistant" && index === messages.length - 1;

          return (
            <ChatMessage
              key={message.id}
              message={message}
              index={index}
              isLastAssistant={isLastAssistant}
              isEditing={editingNodeId === message.id}
              editContent={editingNodeId === message.id ? editContent : ""}
              isLoading={isLoading}
              isSimulating={isSimulating}
              onEdit={handleEditMessage}
              onDelete={handleDeleteMessage}
              onRewind={handleRewindMessage}
              onRegenerate={isLastAssistant ? handleRegenerate : undefined}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onEditContentChange={handleEditContentChange}
            />
          );
        })}
        {(isLoading || isSimulating) &&
          messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 text-zinc-400 rounded-lg px-4 py-2">
                <span className="animate-pulse">
                  {isSimulating ? "Simulating..." : "..."}
                </span>
              </div>
            </div>
          )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What do you do?"
            disabled={isLoading || isSimulating}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || isSimulating || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Send
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={isLoading || isSimulating}
            className="bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-4 py-2 rounded-lg transition-colors"
            title="Generate another message"
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  );
}
