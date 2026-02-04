'use client';

import { useChat, type UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useWorldStore } from '@/store/world-store';
import { useRef, useEffect, useState, useCallback } from 'react';
import type { LocationCluster, WorldState, WorldEvent, Conversation } from '@/types/world';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MESSAGES_STORAGE_KEY = 'surat-chat-messages';
const PROCESSED_TOOLS_KEY = 'surat-processed-tools';

async function loadStoredMessages(): Promise<UIMessage[]> {
  try {
    const res = await fetch(`/api/storage?key=${MESSAGES_STORAGE_KEY}`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) return data;

    // Migration: Check localStorage if API is empty
    if (typeof window !== 'undefined') {
      const local = localStorage.getItem(MESSAGES_STORAGE_KEY);
      if (local) return JSON.parse(local);
    }
    return [];
  } catch {
    return [];
  }
}

async function saveMessages(messages: UIMessage[]) {
  try {
    await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: MESSAGES_STORAGE_KEY, value: messages }),
    });
  } catch (e) {
    console.error('Failed to save messages', e);
  }
}

async function loadProcessedTools(): Promise<Set<string>> {
  try {
    const res = await fetch(`/api/storage?key=${PROCESSED_TOOLS_KEY}`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) return new Set(data);

    // Migration: Check localStorage if API is empty
    if (typeof window !== 'undefined') {
      const local = localStorage.getItem(PROCESSED_TOOLS_KEY);
      if (local) return new Set(JSON.parse(local));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

async function saveProcessedTools(tools: Set<string>) {
  try {
    await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: PROCESSED_TOOLS_KEY, value: [...tools] }),
    });
  } catch (e) {
    console.error('Failed to save processed tools', e);
  }
}

export async function clearChatStorage() {
  await fetch('/api/storage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: MESSAGES_STORAGE_KEY, value: [] }),
  });
  await fetch('/api/storage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: PROCESSED_TOOLS_KEY, value: [] }),
  });
}

async function resolveLocationViaApi(
  description: string,
  existingClusters: LocationCluster[]
): Promise<{ clusterId: string | null; canonicalName: string; isNew: boolean }> {
  const res = await fetch('/api/locations/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, existingClusters }),
  });
  return res.json();
}

async function runSimulationViaApi(
  worldState: WorldState,
  playerLocationClusterId: string,
  timeSinceLastSimulation: number
): Promise<{
  events: WorldEvent[];
  conversations: Omit<Conversation, 'id'>[];
  characterUpdates: { characterId: string; newLocationId: string }[];
}> {
  const res = await fetch('/api/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ worldState, playerLocationClusterId, timeSinceLastSimulation }),
  });
  return res.json();
}

interface MovementResult {
  type: 'movement';
  destination: string;
  narrativeTime?: string;
  timeCost: number;
}

interface TimeAdvanceResult {
  type: 'time_advance';
  narrativeTime: string;
  timeCost: number;
}

interface CharacterDiscoveryResult {
  type: 'character_discovery';
  characterName: string;
  introduction: string;
}

type ToolResult = MovementResult | TimeAdvanceResult | CharacterDiscoveryResult;

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^\w\s]/g, '').trim();
}

function findBestCharacterMatch(
  searchName: string,
  characters: any[]
): { id: string; name: string } | null {
  const normalizedSearch = normalizeName(searchName);

  // 1. Exact match (case insensitive)
  const exact = characters.find(c =>
    c.name.toLowerCase() === searchName.toLowerCase()
  );
  if (exact) return exact;

  // 2. Normalized exact match
  const normalizedExact = characters.find(c =>
    normalizeName(c.name) === normalizedSearch
  );
  if (normalizedExact) return normalizedExact;

  // 3. Substring match (name contains search or search contains name)
  // We prefer the one where the Character name starts with the Search name
  const bestPartial = characters.find(c => {
    const normChar = normalizeName(c.name);
    return normChar.includes(normalizedSearch) || normalizedSearch.includes(normChar);
  });

  return bestPartial || null;
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
  const isSimulating = useWorldStore((s) => s.isSimulating);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const processedToolResults = useRef<Set<string>>(new Set());
  const lastSimulationTick = useRef(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  /* eslint-disable react-hooks/exhaustive-deps */
  const processToolResult = useCallback(async (result: ToolResult, messageId: string, toolCallId: string) => {
    // eslint-enable react-hooks/exhaustive-deps
    const resultKey = `${messageId}-${toolCallId}`;
    if (processedToolResults.current.has(resultKey)) return;
    processedToolResults.current.add(resultKey);
    saveProcessedTools(processedToolResults.current);

    // Get fresh world state from store (not stale closure)
    const currentWorld = useWorldStore.getState().world;
    if (!currentWorld) return;

    if (result.type === 'movement' && result.destination) {
      const previousLocationId = currentWorld.characters.find(c => c.id === currentWorld.playerCharacterId)?.currentLocationClusterId;

      const resolved = await resolveLocationViaApi(
        result.destination,
        currentWorld.locationClusters
      );

      let clusterId = resolved.clusterId;
      if (resolved.isNew) {
        const newCluster = addLocationCluster({
          canonicalName: resolved.canonicalName,
          centroidEmbedding: [],
        });
        clusterId = newCluster.id;
      }

      if (clusterId) {
        moveCharacter(currentWorld.playerCharacterId, clusterId);

        const timeSinceLastSimulation = currentWorld.time.tick - lastSimulationTick.current;
        if (timeSinceLastSimulation > 5 && previousLocationId !== clusterId) {
          setSimulating(true);
          try {
            const { events, conversations, characterUpdates } = await runSimulationViaApi(
              currentWorld,
              clusterId,
              timeSinceLastSimulation
            );

            for (const event of events) {
              addEvent(event);
              for (const witnessId of event.witnessedByIds) {
                updateCharacterKnowledge(witnessId, {
                  content: event.description,
                  acquiredAt: currentWorld.time.tick,
                  source: 'witnessed',
                });
              }
            }
            for (const conv of conversations) {
              addConversation(conv);
            }
            if (characterUpdates) {
              for (const update of characterUpdates) {
                moveCharacter(update.characterId, update.newLocationId);
              }
            }
            lastSimulationTick.current = currentWorld.time.tick;
          } finally {
            setSimulating(false);
          }
        }
      }

      advanceTime(result.timeCost ?? 5, result.narrativeTime);
    } else if (result.type === 'time_advance') {
      advanceTime(result.timeCost ?? 5, result.narrativeTime);
    } else if (result.type === 'character_discovery' && result.characterName) {
      const match = findBestCharacterMatch(result.characterName, currentWorld.characters);

      if (match) {
        discoverCharacter(match.id);
      } else {
        // Create new ephemeral character
        const playerLocation = currentWorld.characters.find(c => c.id === currentWorld.playerCharacterId)?.currentLocationClusterId;

        useWorldStore.getState().addCharacter({
          name: result.characterName,
          description: result.introduction || 'A person encountered in the world.',
          isPlayer: false,
          encounterChance: 0, // Dynamic characters don't have base encounter logic
          currentLocationClusterId: playerLocation || currentWorld.locationClusters[0].id,
          knowledge: [],
          relationships: [],
          isDiscovered: true,
          createdByMessageId: messageId,
        });
      }
    }
  }, [advanceTime, addLocationCluster, moveCharacter, discoverCharacter, addEvent, addConversation, updateCharacterKnowledge, setSimulating]);

  const { messages, sendMessage, status, setMessages, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { worldState: world },
    }),
    onFinish: () => {
      setMessages(currentMessages => {
        // Clean up the trigger message so it doesn't pollute the history
        const lastUserMsgIndex = currentMessages.findLastIndex((m: UIMessage) => m.role === 'user');
        if (lastUserMsgIndex !== -1) {
          const lastUserMsg = currentMessages[lastUserMsgIndex];
          const isTrigger = (lastUserMsg as any).content === '__SURAT_CONTINUE__' ||
            (lastUserMsg.parts && lastUserMsg.parts.some((p: any) => p.type === 'text' && (p as any).text === '__SURAT_CONTINUE__'));

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

  const isLoading = status === 'streaming' || status === 'submitted';

  // Load persisted messages and processed tools on mount
  useEffect(() => {
    const load = async () => {
      const storedMessages = await loadStoredMessages();
      if (storedMessages.length > 0) {
        setMessages(storedMessages);
      }
      processedToolResults.current = await loadProcessedTools();
      setIsHydrated(true);
    };
    load();
  }, [setMessages]);

  // Persist messages when they change (after hydration)
  useEffect(() => {
    if (isHydrated && messages.length > 0) {
      saveMessages(messages);
    }
  }, [messages, isHydrated]);

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
        processedToolResults.current.delete(`${lastAssistant.id}-${part.type}`);
      }
    }
    saveProcessedTools(processedToolResults.current);

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
      const msgAny = message as any;
      if (msgAny.toolInvocations) {
        for (const tool of msgAny.toolInvocations) {
          if (tool.state === 'result') {
            const result = tool.result;
            if (result && typeof result === 'object' && 'type' in result) {
              processToolResult(result, message.id, tool.toolCallId);
            }
          }
        }
      }

      // Check explicit parts (V6 style & custom stream formats)
      for (const part of message.parts) {
        const pAny = part as any;

        // CASE 1: Standard 'tool-result' part
        if (part.type === 'tool-result') {
          const result = pAny.result;
          if (result && typeof result === 'object' && 'type' in result) {
            processToolResult(result, message.id, pAny.toolCallId);
          }
        }

        // CASE 2: Dynamic tool part (e.g., 'tool-moveToLocation') with output
        else if (part.type.startsWith('tool-') && pAny.state === 'output-available' && pAny.output) {
          const result = pAny.output;
          if (result && typeof result === 'object' && 'type' in result) {
            // Use the identifier from the propery or generate one if missing
            const callId = pAny.toolCallId || `${message.id}-${part.type}`;
            processToolResult(result, message.id, callId);
          }
        }
      }
    }
  }, [messages, processToolResult]);

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
          const textPart = message.parts.find(p => p.type === 'text');
          if (message.role === 'user' && textPart && ((textPart as any).text === 'Continue' || (textPart as any).text === '__SURAT_CONTINUE__')) {
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
                    <div className="flex flex-col gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => {
                          const textPart = message.parts.find(p => p.type === 'text');
                          if (textPart && 'text' in textPart) {
                            setEditingNodeId(message.id);
                            setEditContent(textPart.text);
                          }
                        }}
                        className="text-zinc-500 hover:text-blue-400 transition-colors p-1"
                        title="Edit message"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          const newMessages = messages.filter((_, i) => i !== index);
                          for (const part of message.parts) {
                            if (part.type.startsWith('tool-')) {
                              processedToolResults.current.delete(`${message.id}-${part.type}`);
                            }
                          }
                          saveProcessedTools(processedToolResults.current);
                          setMessages(newMessages);
                        }}
                        className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                        title="Delete message"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          const newMessages = messages.slice(0, index);
                          for (let i = index; i < messages.length; i++) {
                            for (const part of messages[i].parts) {
                              if (part.type.startsWith('tool-')) {
                                processedToolResults.current.delete(`${messages[i].id}-${part.type}`);
                              }
                            }
                          }
                          saveProcessedTools(processedToolResults.current);
                          setMessages(newMessages);
                        }}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                        title="Rewind to here"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                        </svg>
                      </button>
                    </div>
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
                            onClick={() => {
                              // Update the message content
                              const newMessages = [...messages];
                              const msgIndex = newMessages.findIndex(m => m.id === message.id);
                              if (msgIndex !== -1) {
                                const newParts = [...newMessages[msgIndex].parts];
                                const textPartIndex = newParts.findIndex(p => p.type === 'text');
                                if (textPartIndex !== -1) {
                                  newParts[textPartIndex] = { ...newParts[textPartIndex], text: editContent } as any;
                                  newMessages[msgIndex] = { ...newMessages[msgIndex], parts: newParts };
                                  setMessages(newMessages);
                                }
                              }
                              setEditingNodeId(null);
                            }}
                            className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      message.parts.map((part, i) => {
                        if (part.type === 'text') {
                          return (
                            <div key={i} className="prose prose-invert max-w-none break-words">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                  a: ({ node, ...props }) => <a className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                  ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2" {...props} />,
                                  ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                                  li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                                  code: ({ node, ...props }) => <code className="bg-zinc-700/50 px-1 py-0.5 rounded text-xs font-mono" {...props} />,
                                  pre: ({ node, ...props }) => <pre className="bg-zinc-900/50 p-2 rounded mb-2 overflow-x-auto" {...props} />,
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
                    <div className="flex flex-col gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => {
                          const textPart = message.parts.find(p => p.type === 'text');
                          if (textPart && 'text' in textPart) {
                            setEditingNodeId(message.id);
                            setEditContent(textPart.text);
                          }
                        }}
                        className="text-zinc-500 hover:text-blue-400 transition-colors p-1"
                        title="Edit message"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          const newMessages = messages.filter((_, i) => i !== index);
                          for (const part of message.parts) {
                            if (part.type.startsWith('tool-')) {
                              processedToolResults.current.delete(`${message.id}-${part.type}`);
                            }
                          }
                          saveProcessedTools(processedToolResults.current);
                          setMessages(newMessages);
                        }}
                        className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                        title="Delete message"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          const newMessages = messages.slice(0, index);
                          for (let i = index; i < messages.length; i++) {
                            for (const part of messages[i].parts) {
                              if (part.type.startsWith('tool-')) {
                                processedToolResults.current.delete(`${messages[i].id}-${part.type}`);
                              }
                            }
                          }
                          saveProcessedTools(processedToolResults.current);
                          setMessages(newMessages);
                        }}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                        title="Rewind to here"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                        </svg>
                      </button>
                    </div>
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
