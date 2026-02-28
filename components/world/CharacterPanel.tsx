'use client';

import { useState, useMemo } from 'react';
import { useWorldStore } from '@/store/world-store';

export function CharacterPanel() {
  const allCharacters = useWorldStore((s) => s.world?.characters ?? []);
  const characters = allCharacters.filter(c => c.isDiscovered && !c.isPlayer);
  const locationClusters = useWorldStore((s) => s.world?.locationClusters ?? []);

  // O(1) lookup map for location clusters to prevent O(N*M) lookups during render
  const locationClusterMap = useMemo(() => {
    return new Map(locationClusters.map(c => [c.id, c]));
  }, [locationClusters]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const updateCharacter = useWorldStore((s) => s.updateCharacter);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string, description: string }>({ name: '', description: '' });

  const startEditing = (char: any) => {
    setEditingId(char.id);
    setEditForm({ name: char.name, description: char.description });
    setExpandedId(char.id); // Ensure expanded when editing
  };

  const saveEdit = (charId: string) => {
    updateCharacter(charId, editForm);
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const toggleExpand = (charId: string) => {
    if (editingId === charId) return; // Prevent collapse while editing
    setExpandedId(expandedId === charId ? null : charId);
  };

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
        const location = locationClusterMap.get(char.currentLocationClusterId);
        const isExpanded = expandedId === char.id;
        const isEditing = editingId === char.id;

        return (
          <div key={char.id} className="border-b border-zinc-800">
            <div className="flex items-center justify-between w-full hover:bg-zinc-900 transition-colors pr-2">
              {isEditing ? (
                <div className="flex-1 px-4 py-3 text-left">
                  <div className="flex flex-col gap-0.5 flex-1 mr-4">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 w-full mb-1 focus:outline-none focus:border-blue-500"
                      aria-label="Character name"
                    />
                    <span className="text-xs text-zinc-500">
                      {location?.canonicalName ?? 'Unknown'}
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => toggleExpand(char.id)}
                  className="flex-1 px-4 py-3 text-left focus:outline-none focus:bg-zinc-800/50 group"
                  aria-expanded={isExpanded}
                >
                  <div className="flex flex-col gap-0.5 flex-1 mr-4">
                    <span className="text-sm font-medium text-zinc-200">
                      {char.name}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {location?.canonicalName ?? 'Unknown'}
                    </span>
                  </div>
                </button>
              )}

              {!isEditing && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEditing(char)}
                    className="text-xs text-blue-500 hover:text-blue-400 px-2 py-1 rounded hover:bg-blue-500/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors"
                    aria-label={`Edit ${char.name}`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleExpand(char.id)}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-500/50 transition-colors"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3">
                {isEditing ? (
                  <div className="space-y-3">
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-sm text-zinc-100 min-h-[100px] focus:outline-none focus:border-blue-500"
                      aria-label="Character description"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={cancelEdit}
                        className="text-xs px-3 py-1 text-zinc-400 hover:text-zinc-200 rounded focus:outline-none focus:ring-2 focus:ring-zinc-500"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(char.id)}
                        className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">{char.description}</p>
                )}

                {!isEditing && char.knowledge.length > 0 && (
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
