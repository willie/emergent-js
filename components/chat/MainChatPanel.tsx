'use client';

import { useChat, type UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useWorldStore } from '@/store/world-store';
import { useSettingsStore } from '@/store/settings-store';
import { useRef, useEffect, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatPersistence, clearChatStorage } from '@/lib/hooks/use-chat-persistence';
import { processToolResult, type ToolResult, type WorldActions } from '@/lib/chat/tool-processor';
import { MessageActions } from './MessageActions';

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
  const isSimulating = useWorldStore((s) => s.isSimulating);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const lastSimulationTick = useRef(0);
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

  const handleRegenerate = () => {
    if (isLoading || isSimulating) return;
    if (messages.length < 2) return;

    // Find the last user message
    const lastAssistant = messages[messages.length - 1];
    const lastUser = messages[messages.length - 2];

    if (lastAssistant?.role !== 'assistant' || lastUser?.role !== 'user') return;

    // Clear processed tool results for the assistant message
    for (const part of lastAssistant.parts) {
      if (part.type.startsWith('tool-')) {
        processedTools.current.delete(`${lastAssistant.id}-${part.type}`);
      }
    }

    // Remove any characters created by this message (to avoid duplicates if name changes)
    removeCharactersByCreatorMessageId(lastAssistant.id);

    // Regenerate the last response
    regenerate();
  };

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

  const handleEditMessage = (messageId: string, content: string) => {
    setEditingNodeId(messageId);
    setEditContent(content);
  };

  const handleDeleteMessage = (messageIndex: number) => {
    const newMessages = messages.filter((_, i) => i !== messageIndex);
    setMessages(newMessages);
  };

  const handleRewindMessage = (messageIndex: number) => {
    const newMessages = messages.slice(0, messageIndex);
    setMessages(newMessages);
  };

  const handleProcessedToolsClear = () => {
    // Persistence is handled via markToolProcessed, no additional action needed
  };

  const handleSaveEdit = (messageId: string) => {
    const newMessages = [...messages];
    const msgIndex = newMessages.findIndex(m => m.id === messageId);
    if (msgIndex !== -1) {
      const newParts = [...newMessages[msgIndex].parts];
      const textPartIndex = newParts.findIndex(p => p.type === 'text');
      if (textPartIndex !== -1 && isTextPart(newParts[textPartIndex])) {
        newParts[textPartIndex] = { type: 'text', text: editContent };
        newMessages[msgIndex] = { ...newMessages[msgIndex], parts: newParts };
        setMessages(newMessages);
      }
    }
    setEditingNodeId(null);
  };

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
          // Hide "Continue" messages from the UI to make the flow seamless
          const textPart = message.parts.find(isTextPart);
          if (message.role === 'user' && textPart && (textPart.text === 'Continue' || textPart.text === '__SURAT_CONTINUE__')) {
            return null;
          }

          const isLastAssistant = message.role === 'assistant' && index === messages.length - 1;
          return (
            <div
              key={message.id}
              className={`group flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-start gap-2">
                  {message.role === 'assistant' && (
                    <MessageActions
                      message={message}
                      messageIndex={index}
                      messages={messages}
                      onEdit={handleEditMessage}
                      onDelete={handleDeleteMessage}
                      onRewind={handleRewindMessage}
                      processedToolResults={processedTools}
                      onProcessedToolsClear={handleProcessedToolsClear}
                    />
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-100'
                      }`}
                  >
                    {editingNodeId === message.id ? (
                      <div className="flex flex-col gap-2 min-w-[300px]">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full bg-zinc-900/50 text-zinc-100 p-2 rounded border border-zinc-700 focus:outline-none focus:border-blue-500 resize-y min-h-[100px]"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingNodeId(null)}
                            className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEdit(message.id)}
                            className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      message.parts.map((part, i) => {
                        if (isTextPart(part)) {
                          return (
                            <div key={i} className="prose prose-invert max-w-none break-words">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                  a: ({ ...props }) => <a className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                  ul: ({ ...props }) => <ul className="list-disc pl-4 mb-2" {...props} />,
                                  ol: ({ ...props }) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                                  li: ({ ...props }) => <li className="mb-1" {...props} />,
                                  code: ({ ...props }) => <code className="bg-zinc-700/50 px-1 py-0.5 rounded text-xs font-mono" {...props} />,
                                  pre: ({ ...props }) => <pre className="bg-zinc-900/50 p-2 rounded mb-2 overflow-x-auto" {...props} />,
                                }}
                              >
                                {part.text}
                              </ReactMarkdown>
                            </div>
                          );
                        }
                        return null;
                      })
                    )}
                  </div>
                  {message.role === 'user' && (
                    <MessageActions
                      message={message}
                      messageIndex={index}
                      messages={messages}
                      onEdit={handleEditMessage}
                      onDelete={handleDeleteMessage}
                      onRewind={handleRewindMessage}
                      processedToolResults={processedTools}
                      onProcessedToolsClear={handleProcessedToolsClear}
                    />
                  )}
                </div>
                {isLastAssistant && !isLoading && !isSimulating && (
                  <button
                    onClick={handleRegenerate}
                    className="self-start text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-1"
                  >
                    Regenerate
                  </button>
                )}
              </div>
            </div>
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
