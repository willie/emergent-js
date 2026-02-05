'use client';

import { useState } from 'react';
import { useWorldStore } from '@/store/world-store';

interface OffscreenPanelProps {
  conversationId: string;
}

export function OffscreenPanel({ conversationId }: OffscreenPanelProps) {
  const world = useWorldStore((s) => s.world);
  const getCharacterById = useWorldStore((s) => s.getCharacterById);
  const getLocationCluster = useWorldStore((s) => s.getLocationCluster);
  const [isExpanded, setIsExpanded] = useState(true);

  if (!world) return null;

  const conversation = world.conversations.find((c) => c.id === conversationId);
  if (!conversation) return null;

  const participants = conversation.participantIds
    .map((id) => getCharacterById(id))
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const location = getLocationCluster(conversation.locationClusterId);

  // Calculate time range
  const ticks = conversation.messages.map(m => m.timestamp);
  const minTick = Math.min(...ticks);
  const maxTick = Math.max(...ticks);
  const timeDisplay = ticks.length > 0
    ? (minTick === maxTick ? `Tick ${minTick}` : `Ticks ${minTick}-${maxTick}`)
    : '';

  return (
    <div className="border-b border-zinc-800">
      {/* Header - click to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-900 transition-colors text-left"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-zinc-200">
            {participants.map((p) => p.name).join(' & ')}
          </span>
          <span className="text-xs text-zinc-500">
            {location?.canonicalName ?? 'Unknown location'}
            {timeDisplay && <span className="ml-2 opacity-60">• {timeDisplay}</span>}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''
            }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button >

      {/* Scrollable content */}
      {
        isExpanded && (
          <div className="max-h-64 overflow-y-auto px-4 pb-4 space-y-2">
            {conversation.messages.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">Nothing yet...</p>
            ) : (
              conversation.messages.map((message) => {
                const speaker = message.speakerId
                  ? getCharacterById(message.speakerId)
                  : null;
                return (
                  <div key={message.id} className="text-sm">
                    {speaker && (
                      <span className="font-medium text-zinc-400">
                        {speaker.name}:{' '}
                      </span>
                    )}
                    <span className="text-zinc-300">{message.content}</span>
                  </div>
                );
              })
            )}
          </div>
        )
      }
    </div >
  );
}
