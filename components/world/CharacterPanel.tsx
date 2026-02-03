'use client';

import { useState } from 'react';
import { useWorldStore } from '@/store/world-store';

export function CharacterPanel() {
  const getDiscoveredCharacters = useWorldStore((s) => s.getDiscoveredCharacters);
  const getLocationCluster = useWorldStore((s) => s.getLocationCluster);
  const characters = getDiscoveredCharacters();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (characters.length === 0) {
    return (
      <div className="p-4 text-sm text-zinc-600 text-center">
        No characters discovered yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {characters.map((char) => {
        const location = getLocationCluster(char.currentLocationClusterId);
        const isExpanded = expandedId === char.id;

        return (
          <div key={char.id} className="border-b border-zinc-800">
            <button
              onClick={() => setExpandedId(isExpanded ? null : char.id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-900 transition-colors text-left"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-zinc-200">
                  {char.name}
                </span>
                <span className="text-xs text-zinc-500">
                  {location?.canonicalName ?? 'Unknown'}
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-zinc-500 transition-transform ${
                  isExpanded ? 'rotate-180' : ''
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
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3">
                <p className="text-sm text-zinc-400">{char.description}</p>

                {char.knowledge.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-zinc-500 mb-1">Knows:</h4>
                    <ul className="space-y-1">
                      {char.knowledge.slice(-5).map((k) => (
                        <li key={k.id} className="text-xs text-zinc-400">
                          {k.content}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
