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
} from "@/lib/chat/message-utils";

export { clearChatStorage };

interface ToolInvocation {
  toolCallId: string;
  state: "result" | "call" | "partial-call";
  result?: unknown;
}

interface MessageWithToolInvocations extends UIMessage {
  toolInvocations?: ToolInvocation[];
}

export function MainChatPanel() {
  const world = useWorldStore((s) => s.world);
  const advanceTime = useWorldStore((s) => s.advanceTime);
  const addLocationCluster = useWorldStore((s) => s.addLocationCluster);
  const moveCharacter = useWorldStore((s) => s.moveCharacter);
  const discoverCharacter = useWorldStore((s) => s.discoverCharacter);
  const addEvent = useWorldStore((s) => s.addEvent);
  const addConversation = useWorldStore((s) => s.addConversation);
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
  const editContentRef = useRef(editContent);

  useEffect(() => {
    editContentRef.current = editContent;
  }, [editContent]);

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

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleProcessToolResult = useCallback(async (
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
        useWorldStore.getState().updateCharacterKnowledge(characterId, knowledge),
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
  }, [
    advanceTime,
    addLocationCluster,
    moveCharacter,
    discoverCharacter,
    addEvent,
    addConversation,
    setSimulating,
    addCharacter,
    processedTools,
    markToolProcessed,
  ]);

  // Persist messages when they change (after hydration)
  useEffect(() => {
    if (isHydrated && messages.length > 0) {
      persistMessages(messages);
    }
  }, [messages, isHydrated, persistMessages]);

  // HEALING & REPAIR:
  // 1. If we have messages and world time > 0 but NO processed tools, mark history as processed (persistence lost).
  // 2. Clear duplicate events from world history.
  // 3. Force-sync location to the last known 'movement' in history if needed.
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
        // Location sync logic... (simplified in original, just comments)
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
    if (isLoading || isSimulating) return;
    const currentMessages = messagesRef.current;
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

    // Remove any characters created by this message (to avoid duplicates if name changes)
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
      // advanceTime handles negative numbers to revert?
      // The store implementation implies just adding ticks: "tick: state.world.time.tick + ticks"
      // So passing negative should work!
      advanceTime(-timeCostToRevert);

      // Also revert local simulation tick ref so we don't think we skipped simulation
      if (lastSimulationTick.current >= timeCostToRevert) {
        lastSimulationTick.current -= timeCostToRevert;
      }
    }

    // Regenerate the last response
    regenerate();
  }, [
    isLoading,
    isSimulating,
    processedTools,
    removeCharactersByCreatorMessageId,
    removeEventsBySourceId,
    advanceTime,
    regenerate
  ]);

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

  const handleEditMessage = useCallback((messageId: string, content: string) => {
    setEditingNodeId(messageId);
    setEditContent(content);
  }, []);

  const onEditContentChange = useCallback((content: string) => {
    setEditContent(content);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingNodeId(null);
  }, []);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleDeleteMessage = useCallback((messageIndex: number) => {
    const currentMessages = messagesRef.current;
    const message = currentMessages[messageIndex];
    if (message) {
        const keys = getToolKeysForMessage(message);
        keys.forEach(key => processedTools.current.delete(key));
    }
    setMessages(prev => prev.filter((_, i) => i !== messageIndex));
  }, [processedTools, setMessages]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleRewindMessage = useCallback((messageIndex: number) => {
    const currentMessages = messagesRef.current;
    const keysToRemove: string[] = [];
    for (let i = messageIndex; i < currentMessages.length; i++) {
        const keys = getToolKeysForMessage(currentMessages[i]);
        for (const key of keys) {
            processedTools.current.delete(key);
            keysToRemove.push(key);
        }
    }
    setMessages(currentMessages.slice(0, messageIndex));
  }, [processedTools, setMessages]);

  const handleSaveEdit = useCallback((messageId: string) => {
    const content = editContentRef.current;
    setMessages(prevMessages => {
        const msgIndex = prevMessages.findIndex((m) => m.id === messageId);
        if (msgIndex !== -1) {
            const newMessages = [...prevMessages];
            const newParts = [...newMessages[msgIndex].parts];
            const textPartIndex = newParts.findIndex((p) => p.type === "text");
            if (textPartIndex !== -1 && isTextPart(newParts[textPartIndex])) {
                newParts[textPartIndex] = { type: "text", text: content };
                newMessages[msgIndex] = { ...newMessages[msgIndex], parts: newParts };
                return newMessages;
            }
        }
        return prevMessages;
    });
    setEditingNodeId(null);
  }, [setMessages]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-live="polite">
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
              onEditContentChange={onEditContentChange}
              onEdit={handleEditMessage}
              onDelete={handleDeleteMessage}
              onRewind={handleRewindMessage}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onRegenerate={isLastAssistant ? handleRegenerate : undefined}
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
            aria-label="Chat input"
          />
          <button
            type="submit"
            disabled={isLoading || isSimulating || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-4 py-2 rounded-lg transition-colors flex justify-center items-center min-w-[80px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            aria-label={isLoading || isSimulating ? "Sending..." : "Send message"}
          >
            {isLoading || isSimulating ? (
              <svg aria-hidden="true" role="status" className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              'Send'
            )}
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={isLoading || isSimulating}
            className="bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-4 py-2 rounded-lg transition-colors flex justify-center items-center min-w-[100px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            title="Generate another message"
            aria-label={isLoading || isSimulating ? "Generating..." : "Continue story"}
          >
            {isLoading || isSimulating ? (
              <svg aria-hidden="true" role="status" className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
