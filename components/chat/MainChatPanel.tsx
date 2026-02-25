"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useWorldStore } from "@/store/world-store";
import { useSettingsStore } from "@/store/settings-store";
import { useRef, useEffect, useState, useCallback } from "react";
import {
  useChatPersistence,
  clearChatStorage,
} from "@/lib/hooks/use-chat-persistence";
import { ChatMessage } from "./ChatMessage";
import { isTextPart } from "@/lib/chat/message-utils";
import type { StateDelta, GameMessage } from "@/lib/chat/types";
import { api } from "@/lib/api/client";

export { clearChatStorage };

export function MainChatPanel() {
  const world = useWorldStore((s) => s.world);
  const advanceTime = useWorldStore((s) => s.advanceTime);
  const addLocationCluster = useWorldStore((s) => s.addLocationCluster);
  const moveCharacter = useWorldStore((s) => s.moveCharacter);
  const discoverCharacter = useWorldStore((s) => s.discoverCharacter);
  const addEvent = useWorldStore((s) => s.addEvent);
  const setSimulating = useWorldStore((s) => s.setSimulating);
  const removeCharactersByCreatorMessageId = useWorldStore(
    (s) => s.removeCharactersByCreatorMessageId,
  );
  const addCharacter = useWorldStore((s) => s.addCharacter);
  const removeEventsBySourceId = useWorldStore((s) => s.removeEventsBySourceId);
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

  const modelId = useSettingsStore((s) => s.modelId);
  const { messages, sendMessage, status, setMessages, regenerate } =
    useChat<GameMessage>({
      transport: new DefaultChatTransport({
        api: "/api/chat",
        body: {
          worldState: world,
          modelId,
          lastSimulationTick: lastSimulationTick.current,
        },
      }),
      onFinish: () => {
        setMessages((currentMessages) => {
          // Clean up the trigger message so it doesn't pollute the history
          const lastUserMsgIndex = currentMessages.findLastIndex(
            (m) => m.role === "user",
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

  const { isHydrated, persistMessages } = useChatPersistence<GameMessage>({ setMessages });

  const isLoading = status === "streaming" || status === "submitted";

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Track which deltas we've already applied to avoid double-application
  const appliedDeltas = useRef<Set<string>>(new Set());

  // On hydration, mark all existing message IDs as already applied
  useEffect(() => {
    if (!isHydrated) return;
    for (const message of messages) {
      if (message.role === "assistant" && message.metadata?.stateDelta) {
        appliedDeltas.current.add(message.id);
      }
    }
    // Only run once on hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  // Apply state deltas from assistant messages
  useEffect(() => {
    if (!isHydrated || !world) return;

    for (const message of messages) {
      if (
        message.role === "assistant" &&
        message.metadata?.stateDelta &&
        !appliedDeltas.current.has(message.id)
      ) {
        appliedDeltas.current.add(message.id);
        applyStateDelta(message.metadata.stateDelta, message.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isHydrated]);

  function applyStateDelta(delta: StateDelta, messageId: string) {
    if (!world) return;

    if (delta.timeAdvance) {
      advanceTime(delta.timeAdvance.ticks, delta.timeAdvance.narrativeTime);
    }

    if (delta.movement) {
      let clusterId = delta.movement.resolvedClusterId;

      if (delta.movement.isNewCluster && delta.movement.newClusterName) {
        const newCluster = addLocationCluster({
          canonicalName: delta.movement.newClusterName,
          centroidEmbedding: [],
        });
        clusterId = newCluster.id;
      }

      if (clusterId) {
        moveCharacter(world.playerCharacterId, clusterId);

        if (delta.movement.accompaniedCharacterIds) {
          for (const charId of delta.movement.accompaniedCharacterIds) {
            moveCharacter(charId, clusterId);
          }
        }
      }

      // Trigger simulation if needed
      if (delta.simulationNeeded) {
        triggerSimulation(
          clusterId,
          messageId,
          delta.movement.accompaniedCharacterIds ?? [],
        );
      }
    }

    if (delta.discoveries) {
      for (const disc of delta.discoveries) {
        if (disc.matchedCharacterId) {
          discoverCharacter(disc.matchedCharacterId);
        } else {
          // Create new ephemeral character
          const playerLocation = useWorldStore.getState().world?.characters.find(
            (c) => c.id === world.playerCharacterId,
          )?.currentLocationClusterId;

          addCharacter({
            name: disc.characterName,
            description: disc.introduction || "A person encountered in the world.",
            isPlayer: false,
            encounterChance: 0,
            currentLocationClusterId:
              playerLocation || world.locationClusters[0].id,
            knowledge: [],
            relationships: [],
            isDiscovered: true,
            createdByMessageId: messageId,
            goals: disc.goals,
          });
        }
      }
    }
  }

  async function triggerSimulation(
    playerClusterId: string,
    messageId: string,
    accompaniedCharacterIds: string[],
  ) {
    const currentWorld = useWorldStore.getState().world;
    if (!currentWorld) return;

    const timeSinceLastSim =
      currentWorld.time.tick - lastSimulationTick.current;

    setSimulating(true);
    try {
      const simResult = await api.simulate(
        currentWorld,
        playerClusterId,
        timeSinceLastSim,
        useSettingsStore.getState().modelId,
      );

      if (simResult) {
        const { events, conversations, characterUpdates } = simResult;
        const { updateCharacterKnowledge, addConversation } =
          useWorldStore.getState();

        for (const event of events ?? []) {
          addEvent({ ...event, sourceMessageId: messageId });
          for (const witnessId of event.witnessedByIds ?? []) {
            updateCharacterKnowledge(witnessId, {
              content: event.description,
              acquiredAt: currentWorld.time.tick,
              source: "witnessed",
            });
          }
        }
        for (const conv of conversations ?? []) {
          addConversation(conv);
        }
        if (characterUpdates) {
          for (const update of characterUpdates) {
            if (!accompaniedCharacterIds.includes(update.characterId)) {
              moveCharacter(update.characterId, update.newLocationId);
            }
          }
        }
      }
      lastSimulationTick.current = currentWorld.time.tick;
    } finally {
      setSimulating(false);
    }
  }

  // Persist messages when they change (after hydration)
  useEffect(() => {
    if (isHydrated && messages.length > 0) {
      persistMessages(messages);
    }
  }, [messages, isHydrated, persistMessages]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleRegenerate = useCallback(() => {
    if (isLoading || isSimulating) return;
    const currentMessages = messagesRef.current;
    if (currentMessages.length < 2) return;

    const lastAssistant = currentMessages[currentMessages.length - 1];
    const lastUser = currentMessages[currentMessages.length - 2];

    if (lastAssistant?.role !== "assistant" || lastUser?.role !== "user")
      return;

    // Remove any characters created by this message
    removeCharactersByCreatorMessageId(lastAssistant.id);

    // Remove events generated by this message
    removeEventsBySourceId(lastAssistant.id);

    // Rollback world state using the delta metadata
    const delta = (lastAssistant as GameMessage).metadata?.stateDelta;
    if (delta) {
      if (delta.timeAdvance) {
        advanceTime(-delta.timeAdvance.ticks);
        if (lastSimulationTick.current >= delta.timeAdvance.ticks) {
          lastSimulationTick.current -= delta.timeAdvance.ticks;
        }
      }

      if (delta.movement?.previousClusterId && world) {
        moveCharacter(world.playerCharacterId, delta.movement.previousClusterId);
        // Move accompanied characters back too
        if (delta.movement.accompaniedCharacterIds) {
          for (const charId of delta.movement.accompaniedCharacterIds) {
            moveCharacter(charId, delta.movement.previousClusterId);
          }
        }
      }

      // Allow the delta to be re-applied on regeneration
      appliedDeltas.current.delete(lastAssistant.id);
    }

    regenerate();
  }, [
    isLoading,
    isSimulating,
    removeCharactersByCreatorMessageId,
    removeEventsBySourceId,
    advanceTime,
    moveCharacter,
    world,
    regenerate,
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

  const handleEditMessage = useCallback(
    (messageId: string, content: string) => {
      setEditingNodeId(messageId);
      setEditContent(content);
    },
    [],
  );

  const onEditContentChange = useCallback((content: string) => {
    setEditContent(content);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingNodeId(null);
  }, []);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleDeleteMessage = useCallback(
    (messageIndex: number) => {
      setMessages((prev) => prev.filter((_, i) => i !== messageIndex));
    },
    [setMessages],
  );

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleRewindMessage = useCallback(
    (messageIndex: number) => {
      const currentMessages = messagesRef.current;
      setMessages(currentMessages.slice(0, messageIndex));
    },
    [setMessages],
  );

  const handleSaveEdit = useCallback(
    (messageId: string) => {
      const content = editContentRef.current;
      setMessages((prevMessages) => {
        const msgIndex = prevMessages.findIndex((m) => m.id === messageId);
        if (msgIndex !== -1) {
          const newMessages = [...prevMessages];
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
        return prevMessages;
      });
      setEditingNodeId(null);
    },
    [setMessages],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        role="log"
        aria-live="polite"
      >
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
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-4 py-2 rounded-lg transition-colors flex justify-center items-center min-w-[80px]"
          >
            {isLoading || isSimulating ? (
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              "Send"
            )}
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={isLoading || isSimulating}
            className="bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-4 py-2 rounded-lg transition-colors flex justify-center items-center min-w-[100px]"
            title="Generate another message"
          >
            {isLoading || isSimulating ? (
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              "Continue"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
