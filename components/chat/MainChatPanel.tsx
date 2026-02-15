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
  type MessageWithToolInvocations
} from "@/lib/chat/message-utils";

export { clearChatStorage };

export function MainChatPanel() {
  const world = useWorldStore((s) => s.world);
  const advanceTime = useWorldStore((s) => s.advanceTime);
  const removeCharactersByCreatorMessageId = useWorldStore(
    (s) => s.removeCharactersByCreatorMessageId,
  );
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

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const { processedTools, markToolProcessed, isHydrated, persistMessages } =
    useChatPersistence({ setMessages });

  const isLoading = status === "streaming" || status === "submitted";

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleProcessToolResult = useCallback(async (
    result: ToolResult,
    messageId: string,
    toolCallId: string,
  ) => {
    const worldActions: WorldActions = {
      advanceTime: useWorldStore.getState().advanceTime,
      addLocationCluster: useWorldStore.getState().addLocationCluster,
      moveCharacter: useWorldStore.getState().moveCharacter,
      discoverCharacter: useWorldStore.getState().discoverCharacter,
      addEvent: useWorldStore.getState().addEvent,
      addConversation: useWorldStore.getState().addConversation,
      updateCharacterKnowledge: (characterId, knowledge) =>
        useWorldStore.getState().updateCharacterKnowledge(characterId, knowledge),
      setSimulating: useWorldStore.getState().setSimulating,
      addCharacter: useWorldStore.getState().addCharacter,
      getWorld: () => useWorldStore.getState().world,
    };
    await processToolResult(result, messageId, toolCallId, {
      processedTools: processedTools.current,
      onToolProcessed: markToolProcessed,
      worldActions,
      getModelId: () => useSettingsStore.getState().modelId,
      lastSimulationTick,
    });
  }, [markToolProcessed, processedTools]);

  // Persist messages when they change (after hydration)
  useEffect(() => {
    if (isHydrated && messages.length > 0) {
      persistMessages(messages);
    }
  }, [messages, isHydrated, persistMessages]);

  // HEALING & REPAIR:
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
         // Logging only as per original code
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

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleRegenerate = useCallback(() => {
    const currentMessages = messagesRef.current;
    if (isLoading || isSimulating) return;
    if (currentMessages.length < 2) return;

    // Find the last user message
    const lastAssistant = currentMessages[currentMessages.length - 1];
    const lastUser = currentMessages[currentMessages.length - 2];

    if (lastAssistant?.role !== "assistant" || lastUser?.role !== "user")
      return;

    // Clear processed tool results for the assistant message
    for (const part of lastAssistant.parts) {
      if (part.type.startsWith("tool-")) {
        processedTools.current.delete(`${lastAssistant.id}-${part.type}`);
      }
    }

    removeCharactersByCreatorMessageId(lastAssistant.id);

    // Rollback world state for this message
    // 1. Remove events generated by this message
    removeEventsBySourceId(lastAssistant.id);

    // 2. Revert time if any was passed
    // We need to calculate how much time this message cost
    let timeCostToRevert = 0;

    // Check tool results in the message to find time costs
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

      // Also revert local simulation tick ref so we don't think we skipped simulation
      if (lastSimulationTick.current >= timeCostToRevert) {
        lastSimulationTick.current -= timeCostToRevert;
      }
    }

    // Regenerate the last response
    regenerate();
  }, [isLoading, isSimulating, regenerate, removeCharactersByCreatorMessageId, removeEventsBySourceId, advanceTime, processedTools]);

  // Process tool results when messages change
  useEffect(() => {
    for (const message of messages) {
      if (message.role !== "assistant") continue;

      // Check toolInvocations (common in useChat)
      const msgWithTools = message as MessageWithToolInvocations;
      if (msgWithTools.toolInvocations) {
        for (const tool of msgWithTools.toolInvocations) {
          if (tool.state === "result" && isToolResult(tool.result)) {
            handleProcessToolResult(tool.result, message.id, tool.toolCallId);
          }
        }
      }

      // Check explicit parts (V6 style & custom stream formats)
      for (const part of message.parts) {
        // CASE 1: Standard 'tool-result' part
        if (isToolResultPart(part) && isToolResult(part.result)) {
          handleProcessToolResult(part.result, message.id, part.toolCallId);
        }
        // CASE 2: Dynamic tool part (e.g., 'tool-moveToLocation') with output
        else if (
          isDynamicToolPart(part) &&
          part.state === "output-available" &&
          isToolResult(part.output)
        ) {
          const callId = part.toolCallId || `${message.id}-${part.type}`;
          handleProcessToolResult(part.output, message.id, callId);
        }
      }
    }
  }, [messages, handleProcessToolResult]);

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

  const handleEditMessage = useCallback((messageId: string) => {
    setEditingNodeId(messageId);
  }, []);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleDeleteMessage = useCallback((messageIndex: number) => {
    const currentMessages = messagesRef.current;
    const message = currentMessages[messageIndex];
    if (message) {
        const keys = getToolKeysForMessage(message);
        for (const key of keys) {
            processedTools.current.delete(key);
        }
    }
    const newMessages = currentMessages.filter((_, i) => i !== messageIndex);
    setMessages(newMessages);
  }, [setMessages, processedTools]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleRewindMessage = useCallback((messageIndex: number) => {
    const currentMessages = messagesRef.current;
    for (let i = messageIndex; i < currentMessages.length; i++) {
        const message = currentMessages[i];
        const keys = getToolKeysForMessage(message);
        for (const key of keys) {
            processedTools.current.delete(key);
        }
    }
    const newMessages = currentMessages.slice(0, messageIndex);
    setMessages(newMessages);
  }, [setMessages, processedTools]);

  const handleSaveEdit = useCallback((messageId: string, newContent: string) => {
    const currentMessages = messagesRef.current;
    const newMessages = [...currentMessages];
    const msgIndex = newMessages.findIndex((m) => m.id === messageId);
    if (msgIndex !== -1) {
      const newParts = [...newMessages[msgIndex].parts];
      const textPartIndex = newParts.findIndex((p) => isTextPart(p));
      if (textPartIndex !== -1 && isTextPart(newParts[textPartIndex])) {
        newParts[textPartIndex] = { type: "text", text: newContent };
        newMessages[msgIndex] = { ...newMessages[msgIndex], parts: newParts };
        setMessages(newMessages);
      }
    }
    setEditingNodeId(null);
  }, [setMessages]);

  const handleCancelEdit = useCallback(() => {
    setEditingNodeId(null);
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
        {messages.map((message, index) => (
          <ChatMessage
            key={message.id}
            message={message}
            index={index}
            isLastAssistant={message.role === "assistant" && index === messages.length - 1}
            isLoading={isLoading}
            isSimulating={isSimulating}
            isEditing={editingNodeId === message.id}
            onEdit={handleEditMessage}
            onDelete={handleDeleteMessage}
            onRewind={handleRewindMessage}
            onRegenerate={handleRegenerate}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
          />
        ))}
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
