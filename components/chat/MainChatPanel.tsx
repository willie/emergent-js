'use client';

import { useChat, type UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useWorldStore } from '@/store/world-store';
import { useSettingsStore } from '@/store/settings-store';
import { useRef, useEffect, useState, useCallback } from 'react';
import { useChatPersistence, clearChatStorage } from '@/lib/hooks/use-chat-persistence';
import { processToolResult, type ToolResult, type WorldActions } from '@/lib/chat/tool-processor';
import { ChatMessage } from './ChatMessage';

export { clearChatStorage };

interface TextPart {
  type: 'text';
  text: string;
}

interface ToolInvocation {
  toolCallId: string;
  state: 'result' | 'call' | 'partial-call';
  result?: unknown;
}

interface MessageWithToolInvocations extends UIMessage {
  toolInvocations?: ToolInvocation[];
}

interface ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  result: unknown;
}

interface DynamicToolPart {
  type: string;
  state?: string;
  output?: unknown;
  toolCallId?: string;
}

function isTextPart(part: unknown): part is TextPart {
  return typeof part === 'object' && part !== null && (part as { type?: string }).type === 'text' && 'text' in part;
}

function isToolResultPart(part: unknown): part is ToolResultPart {
  return typeof part === 'object' && part !== null && (part as { type?: string }).type === 'tool-result';
}

function isDynamicToolPart(part: unknown): part is DynamicToolPart {
  if (typeof part !== 'object' || part === null) return false;
  const p = part as { type?: string };
  return typeof p.type === 'string' && p.type.startsWith('tool-');
}

function isToolResult(value: unknown): value is ToolResult {
  return typeof value === 'object' && value !== null && 'type' in value;
}

function getToolKeysForMessage(message: UIMessage): string[] {
  const keys: string[] = [];
  for (const part of message.parts) {
    if (part.type.startsWith('tool-')) {
      keys.push(`${message.id}-${part.type}`);
    }
  }
  return keys;
}

export function MainChatPanel() {
  const world = useWorldStore((s) => s.world);
  const advanceTime = useWorldStore((s) => s.advanceTime);
  const addLocationCluster = useWorldStore((s) => s.addLocationCluster);
  const moveCharacter = useWorldStore((s) => s.moveCharacter);
  const discoverCharacter = useWorldStore((s) => s.discoverCharacter);
  const addEvent = useWorldStore((s) => s.addEvent);
  const addConversation = useWorldStore((s) => s.addConversation);
  const updateCharacterKnowledge = useWorldStore((s) => s.updateCharacterKnowledge);
  const setSimulating = useWorldStore((s) => s.setSimulating);
  const removeCharactersByCreatorMessageId = useWorldStore((s) => s.removeCharactersByCreatorMessageId);
  const addCharacter = useWorldStore((s) => s.addCharacter);
  const removeEventsBySourceId = useWorldStore((s) => s.removeEventsBySourceId);
  const isSimulating = useWorldStore((s) => s.isSimulating);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const lastSimulationTick = useRef(world?.time.tick ?? 0);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const modelId = useSettingsStore((s) => s.modelId);
  const { messages, sendMessage, status, setMessages, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { worldState: world, modelId },
    }),
    onFinish: () => {
      setMessages(currentMessages => {
        // Clean up the trigger message so it doesn't pollute the history
        const lastUserMsgIndex = currentMessages.findLastIndex((m: UIMessage) => m.role === 'user');
        if (lastUserMsgIndex !== -1) {
          const lastUserMsg = currentMessages[lastUserMsgIndex];
          const textPart = lastUserMsg.parts.find(isTextPart);
          const isTrigger = textPart?.text === '__SURAT_CONTINUE__';

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

  // Keep a ref to messages for stable callbacks
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const {
    processedTools,
    markToolProcessed,
    isHydrated,
    persistMessages,
  } = useChatPersistence({ setMessages });

  const isLoading = status === 'streaming' || status === 'submitted';

  // World actions for tool processor
  const worldActions: WorldActions = {
    advanceTime,
    addLocationCluster,
    moveCharacter,
    discoverCharacter,
    addEvent,
    addConversation,
    updateCharacterKnowledge: (characterId, knowledge) => updateCharacterKnowledge(characterId, knowledge),
    setSimulating,
    addCharacter,
    getWorld: () => useWorldStore.getState().world,
  };

  const handleProcessToolResult = useCallback(async (result: ToolResult, messageId: string, toolCallId: string) => {
    await processToolResult(result, messageId, toolCallId, {
      processedTools: processedTools.current,
      onToolProcessed: markToolProcessed,
      worldActions,
      getModelId: () => useSettingsStore.getState().modelId,
      lastSimulationTick,
    });
  }, [markToolProcessed, worldActions, processedTools]);

  // Persist messages when they change (after hydration)
  useEffect(() => {
    if (isHydrated && messages.length > 0) {
      persistMessages(messages);
    }
  }, [messages, isHydrated, persistMessages]);

  // HEALING: If we have messages and world time > 0 but NO processed tools,
  // it means we lost persistence. Mark all current message tools as processed
  // to prevent re-running them and duplicating history.
  useEffect(() => {
    if (isHydrated && messages.length > 0 && processedTools.current.size === 0 && (world?.time.tick ?? 0) > 0) {
      console.log('[CHAT PANEL] Healing processed tools history...');
      messages.forEach(m => {
        if (m.role !== 'assistant') return;

        // Mark tool invocations
        if ((m as any).toolInvocations) {
          (m as any).toolInvocations.forEach((t: any) => {
            if (t.state === 'result') {
              const key = `${m.id}-${t.toolCallId}`;
              markToolProcessed(key);
            }
          });
        }

        // Mark parts
        m.parts.forEach(p => {
          if (p.type === 'tool-result' || (p.type.startsWith('tool-') && (p as any).state === 'output-available')) {
            const callId = (p as any).toolCallId || `${m.id}-${p.type}`;
            const key = `${m.id}-${callId}`;
            markToolProcessed(key);
          }
        });
      });
    }
  }, [isHydrated, messages, world?.time.tick, markToolProcessed, processedTools]);

  const handleRegenerate = useCallback(() => {
    const currentMessages = messagesRef.current;
    if (isLoading || isSimulating) return;
    if (currentMessages.length < 2) return;

    // Find the last user message
    const lastAssistant = currentMessages[currentMessages.length - 1];
    const lastUser = currentMessages[currentMessages.length - 2];

    if (lastAssistant?.role !== 'assistant' || lastUser?.role !== 'user') return;

    // Clear processed tool results for the assistant message
    for (const part of lastAssistant.parts) {
      if (part.type.startsWith('tool-')) {
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
      if (result && typeof result === 'object') {
        if (result.type === 'movement' || result.type === 'time_advance') {
          if (typeof result.timeCost === 'number') {
            timeCostToRevert += result.timeCost;
          }
        }
      }
    };

    if ((lastAssistant as any).toolInvocations) {
      (lastAssistant as any).toolInvocations.forEach((t: any) => {
        if (t.state === 'result') checkToolResult(t.result);
      });
    }

    lastAssistant.parts.forEach(p => {
      if (p.type === 'tool-result') {
        checkToolResult((p as any).result);
      } else if (p.type.startsWith('tool-') && (p as any).state === 'output-available') {
        checkToolResult((p as any).output);
      }
    });

    if (timeCostToRevert > 0) {
      console.log(`[CHAT PANEL] Reverting time by ${timeCostToRevert} ticks for regeneration`);
      advanceTime(-timeCostToRevert);

      // Also revert local simulation tick ref so we don't think we skipped simulation
      if (lastSimulationTick.current >= timeCostToRevert) {
        lastSimulationTick.current -= timeCostToRevert;
      }
    }

    // Regenerate the last response
    regenerate();
  }, [isLoading, isSimulating, processedTools, removeCharactersByCreatorMessageId, removeEventsBySourceId, advanceTime, regenerate]);

  // Process tool results when messages change
  useEffect(() => {
    for (const message of messages) {
      if (message.role !== 'assistant') continue;

      // Check toolInvocations (common in useChat)
      const msgWithTools = message as MessageWithToolInvocations;
      if (msgWithTools.toolInvocations) {
        for (const tool of msgWithTools.toolInvocations) {
          if (tool.state === 'result' && isToolResult(tool.result)) {
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
        else if (isDynamicToolPart(part) && part.state === 'output-available' && isToolResult(part.output)) {
          const callId = part.toolCallId || `${message.id}-${part.type}`;
          handleProcessToolResult(part.output, message.id, callId);
        }
      }
    }
  }, [messages, handleProcessToolResult]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading && !isSimulating) {
      advanceTime(1);
      sendMessage({ text: input });
      setInput('');
    }
  };

  const handleContinue = () => {
    if (isLoading || isSimulating) return;
    advanceTime(1);
    sendMessage({ text: '__SURAT_CONTINUE__' });
  };

  const handleEditMessage = useCallback((messageId: string, content: string) => {
    setEditingNodeId(messageId);
    setEditContent(content);
  }, []);

  const handleDeleteMessage = useCallback((messageIndex: number) => {
    const currentMessages = messagesRef.current;

    // Cleanup tool results for this message
    const message = currentMessages[messageIndex];
    if (message) {
      const keys = getToolKeysForMessage(message);
      for (const key of keys) {
        processedTools.current.delete(key);
      }
    }

    const newMessages = currentMessages.filter((_, i) => i !== messageIndex);
    setMessages(newMessages);
  }, [setMessages]);

  const handleRewindMessage = useCallback((messageIndex: number) => {
    const currentMessages = messagesRef.current;

    // Cleanup tool results for this and following messages
    for (let i = messageIndex; i < currentMessages.length; i++) {
      const keys = getToolKeysForMessage(currentMessages[i]);
      for (const key of keys) {
        processedTools.current.delete(key);
      }
    }

    const newMessages = currentMessages.slice(0, messageIndex);
    setMessages(newMessages);
  }, [setMessages, processedTools]);

  // Use a ref for editContent to avoid re-creating handleSaveEdit on every keystroke
  const editContentRef = useRef(editContent);
  useEffect(() => {
    editContentRef.current = editContent;
  }, [editContent]);

  const handleSaveEditStable = useCallback((messageId: string) => {
    setMessages(prevMessages => {
      const newMessages = [...prevMessages];
      const msgIndex = newMessages.findIndex(m => m.id === messageId);
      if (msgIndex !== -1) {
        const newParts = [...newMessages[msgIndex].parts];
        const textPartIndex = newParts.findIndex(p => p.type === 'text');
        if (textPartIndex !== -1 && isTextPart(newParts[textPartIndex])) {
          newParts[textPartIndex] = { type: 'text', text: editContentRef.current };
          newMessages[msgIndex] = { ...newMessages[msgIndex], parts: newParts };
          return newMessages;
        }
      }
      return prevMessages;
    });
    setEditingNodeId(null);
  }, [setMessages, setEditingNodeId]);

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
          const isLast = index === messages.length - 1;
          const isEditing = editingNodeId === message.id;

          return (
            <ChatMessage
              key={message.id}
              message={message}
              index={index}
              isLast={isLast}
              isLoading={isLoading}
              isSimulating={isSimulating}
              isEditing={isEditing}
              editContent={isEditing ? editContent : ''}
              onEdit={handleEditMessage}
              onDelete={handleDeleteMessage}
              onRewind={handleRewindMessage}
              onRegenerate={handleRegenerate}
              onSaveEdit={handleSaveEditStable}
              onSetEditContent={setEditContent}
              onSetEditingNodeId={setEditingNodeId}
            />
          );
        })}
        {(isLoading || isSimulating) && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 text-zinc-400 rounded-lg px-4 py-2">
              <span className="animate-pulse">
                {isSimulating ? 'Simulating...' : '...'}
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
