'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useWorldStore } from '@/store/world-store';
import { useRef, useEffect, useState, useCallback } from 'react';
import type { LocationCluster, WorldState, WorldEvent, Conversation } from '@/types/world';

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
): Promise<{ events: WorldEvent[]; conversations: Omit<Conversation, 'id'>[] }> {
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

export function MainChatPanel() {
  const world = useWorldStore((s) => s.world);
  const advanceTime = useWorldStore((s) => s.advanceTime);
  const addLocationCluster = useWorldStore((s) => s.addLocationCluster);
  const moveCharacter = useWorldStore((s) => s.moveCharacter);
  const discoverCharacter = useWorldStore((s) => s.discoverCharacter);
  const addEvent = useWorldStore((s) => s.addEvent);
  const addConversation = useWorldStore((s) => s.addConversation);
  const setSimulating = useWorldStore((s) => s.setSimulating);
  const isSimulating = useWorldStore((s) => s.isSimulating);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const processedToolResults = useRef(new Set<string>());
  const lastSimulationTick = useRef(0);

  // Process tool results from messages
  const processToolResult = useCallback(async (result: ToolResult, messageId: string, toolName: string) => {
    const resultKey = `${messageId}-${toolName}`;
    if (processedToolResults.current.has(resultKey)) return;
    processedToolResults.current.add(resultKey);

    if (!world) return;

    if (result.type === 'movement' && result.destination) {
      const previousLocationId = world.characters.find(c => c.id === world.playerCharacterId)?.currentLocationClusterId;

      // Resolve the location via API
      const resolved = await resolveLocationViaApi(
        result.destination,
        world.locationClusters
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
        moveCharacter(world.playerCharacterId, clusterId);

        // Check if we should simulate off-screen interactions
        const timeSinceLastSimulation = world.time.tick - lastSimulationTick.current;
        if (timeSinceLastSimulation > 5 && previousLocationId !== clusterId) {
          setSimulating(true);
          try {
            const { events, conversations } = await runSimulationViaApi(
              world,
              clusterId,
              timeSinceLastSimulation
            );

            // Add events and conversations to the store
            for (const event of events) {
              addEvent(event);
            }
            for (const conv of conversations) {
              addConversation(conv);
            }
            lastSimulationTick.current = world.time.tick;
          } finally {
            setSimulating(false);
          }
        }
      }

      advanceTime(result.timeCost ?? 5, result.narrativeTime);
    } else if (result.type === 'time_advance') {
      advanceTime(result.timeCost ?? 5, result.narrativeTime);
    } else if (result.type === 'character_discovery' && result.characterName) {
      const character = world.characters.find(
        (c) => c.name.toLowerCase() === result.characterName.toLowerCase()
      );
      if (character) {
        discoverCharacter(character.id);
      }
    }
  }, [world, advanceTime, addLocationCluster, moveCharacter, discoverCharacter, addEvent, addConversation, setSimulating]);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { worldState: world },
    }),
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  // Process tool results when messages change
  useEffect(() => {
    for (const message of messages) {
      if (message.role !== 'assistant') continue;
      for (const part of message.parts) {
        // Tool parts have type like 'tool-moveToLocation', 'tool-advanceTime', etc.
        if (part.type.startsWith('tool-') && 'state' in part && part.state === 'output-available' && 'output' in part) {
          const output = part.output as ToolResult;
          if (output && output.type) {
            processToolResult(output, message.id, part.type);
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
      // Advance time by 1 tick for speaking
      advanceTime(1);
      sendMessage({ text: input });
      setInput('');
    }
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
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-100'
              }`}
            >
              {message.parts.map((part, i) => {
                if (part.type === 'text') {
                  return (
                    <p key={i} className="whitespace-pre-wrap">
                      {part.text}
                    </p>
                  );
                }
                // Don't render tool invocations visually
                return null;
              })}
            </div>
          </div>
        ))}
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
        </div>
      </form>
    </div>
  );
}
