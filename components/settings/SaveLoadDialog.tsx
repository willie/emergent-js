'use client';

import { useState, useEffect } from 'react';
import { useWorldStore } from '@/store/world-store';

interface SaveLoadDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

interface SaveFile {
    id: string;
    updatedAt: string;
}

export function SaveLoadDialog({ isOpen, onClose }: SaveLoadDialogProps) {
    const [saves, setSaves] = useState<SaveFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [newSaveName, setNewSaveName] = useState('');
    const [activeSaveId, setActiveSaveId] = useState<string>('surat-world-storage');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('active_save_key');
            if (stored) setActiveSaveId(stored);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            loadSaves();
        }
    }, [isOpen]);

    const loadSaves = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/storage?list=true');
            const data = await res.json();
            if (Array.isArray(data)) {
                // Filter only world storage files
                const worldSaves = data.filter((f: any) => f.id.startsWith('surat-world-storage'));
                // Sort by date desc
                worldSaves.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                setSaves(worldSaves);
            }
        } catch (e) {
            console.error('Failed to load saves', e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSave = () => {
        if (!newSaveName.trim()) return;

        // Create an ID from the name (slugify)
        const slug = newSaveName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const newId = `surat-world-storage-${slug}`;

        // Check if exists
        if (saves.some(s => s.id === newId)) {
            alert('A save with this name already exists.');
            return;
        }

        // To "Create" a save, we simply switch to it and reload. 
        // The app will initialize a new world if empty.
        // However, keeping the *current* state vs starting fresh?
        // User probably wants a NEW game.
        // So we switch to the new slot. The store will see empty data and init new scenario.
        if (confirm(`Start a new game as "${newSaveName}"?`)) {
            localStorage.setItem('active_save_key', newId);
            window.location.reload();
        }
    };

    const handleLoad = (id: string) => {
        if (id === activeSaveId) return;
        if (confirm('Switch to this game?')) {
            localStorage.setItem('active_save_key', id);
            window.location.reload();
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this save? This cannot be undone.')) {
            try {
                await fetch(`/api/storage?key=${id}`, { method: 'DELETE' });

                // Also delete associated chat and tools
                const suffix = id.replace('surat-world-storage', '');
                await fetch(`/api/storage?key=surat-chat-messages${suffix}`, { method: 'DELETE' });
                await fetch(`/api/storage?key=surat-processed-tools${suffix}`, { method: 'DELETE' });

                await loadSaves();

                if (id === activeSaveId) {
                    // switch to default if we deleted active
                    localStorage.setItem('active_save_key', 'surat-world-storage');
                    window.location.reload();
                }
            } catch (err) {
                console.error('Failed to delete', err);
            }
        }
    };

    const getDisplayName = (id: string) => {
        if (id === 'surat-world-storage') return 'Default';
        return id.replace('surat-world-storage-', '').replace(/-/g, ' ');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-full max-w-md shadow-xl max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-medium text-zinc-100">Saved Games</h3>
                    <button
                        onClick={onClose}
                        className="text-zinc-500 hover:text-zinc-300"
                        aria-label="Close dialog"
                    >
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                </div>

                {/* Create New */}
                <div className="flex gap-2 mb-6">
                    <input
                        type="text"
                        placeholder="New save name..."
                        value={newSaveName}
                        onChange={(e) => setNewSaveName(e.target.value)}
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                        onClick={handleCreateSave}
                        disabled={!newSaveName.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded transition-colors whitespace-nowrap"
                    >
                        Create
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {loading ? (
                        <p className="text-zinc-500 text-center py-4">Loading saves...</p>
                    ) : saves.length === 0 ? (
                        <p className="text-zinc-500 text-center py-4">No saves found.</p>
                    ) : (
                        saves.map((save) => {
                            const isActive = save.id === activeSaveId;
                            return (
                                <div
                                    key={save.id}
                                    className={`group flex items-center justify-between p-1 pr-2 rounded-lg border transition-all ${isActive
                                        ? 'bg-blue-900/20 border-blue-500/50'
                                        : 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800'
                                        }`}
                                >
                                    <button
                                        onClick={() => handleLoad(save.id)}
                                        className="flex-1 text-left min-w-0 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        aria-label={`Load save ${getDisplayName(save.id)}`}
                                    >
                                        <div className="min-w-0">
                                            <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-400' : 'text-zinc-200'}`}>
                                                {getDisplayName(save.id)}
                                                {isActive && <span className="ml-2 text-xs text-blue-500/80">(Current)</span>}
                                            </p>
                                            <p className="text-xs text-zinc-500">
                                                {new Date(save.updatedAt).toLocaleString()}
                                            </p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={(e) => handleDelete(save.id, e)}
                                        className="p-2 text-zinc-600 hover:text-red-400 transition-all rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                                        title="Delete Save"
                                        aria-label={`Delete save ${getDisplayName(save.id)}`}
                                    >
                                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between items-center">
                    <button
                        onClick={() => {
                            if (confirm('Exit to Main Menu? Current game is auto-saved.')) {
                                // Clear active key so we don't auto-reload into this game
                                localStorage.removeItem('active_save_key');
                                // Reset store to null to trigger Landing Page
                                useWorldStore.getState().resetWorld();
                                onClose();
                            }
                        }}
                        className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                    >
                        Exit to Main Menu
                    </button>

                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
