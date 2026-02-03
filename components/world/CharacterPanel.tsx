'use client';

import { useState } from 'react';
import { useWorldStore } from '@/store/world-store';

export function CharacterPanel() {
  const allCharacters = useWorldStore((s) => s.world?.characters ?? []);
  const characters = allCharacters.filter(c => c.isDiscovered && !c.isPlayer);
  const locationClusters = useWorldStore((s) => s.world?.locationClusters ?? []);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const updateCharacter = useWorldStore((s) => s.updateCharacter);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string, description: string }>({ name: '', description: '' });

  const startEditing = (char: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(char.id);
    setEditForm({ name: char.name, description: char.description });
    setExpandedId(char.id); // Ensure expanded when editing
  };

  const saveEdit = (charId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateCharacter(charId, editForm);
    setEditingId(null);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
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
        const location = locationClusters.find(c => c.id === char.currentLocationClusterId);
        const isExpanded = expandedId === char.id;
        const isEditing = editingId === char.id;

        return (
          <div key={char.id} className="border-b border-zinc-800">
            <button
              onClick={() => !isEditing && setExpandedId(isExpanded ? null : char.id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-900 transition-colors text-left"
            >
              <div className="flex flex-col gap-0.5 flex-1 mr-4">
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 w-full mb-1"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="text-sm font-medium text-zinc-200">
                    {char.name}
                  </span>
                )}

                <span className="text-xs text-zinc-500">
                  {location?.canonicalName ?? 'Unknown'}
                </span>
              </div>

              {!isEditing && (
                <div className="flex items-center gap-2">
                  <span
                    onClick={(e) => startEditing(char, e)}
                    className="text-xs text-blue-500 hover:text-blue-400 cursor-pointer px-2 py-1"
                  >
                    Edit
                  </span>
                  <svg
                    className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
                </div>
              )}
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3">
                {isEditing ? (
                  <div className="space-y-3">
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-sm text-zinc-100 min-h-[100px]"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={(e) => cancelEdit(e)}
                        className="text-xs px-3 py-1 text-zinc-400 hover:text-zinc-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={(e) => saveEdit(char.id, e)}
                        className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded"
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
