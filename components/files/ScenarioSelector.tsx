'use client';

import { useState, useEffect } from 'react';
import { useWorldStore } from '@/store/world-store';
import { defaultScenario } from '@/data/default-scenario';
import { ScenarioImportDialog } from './ScenarioImportDialog';
import type { ScenarioConfig } from '@/types/world';

export function ScenarioSelector() {
    const initializeScenario = useWorldStore((s) => s.initializeScenario);
    const [showImport, setShowImport] = useState(false);
    const [activeTab, setActiveTab] = useState<'new' | 'load'>('new');

    // Logic for saved games
    const [saves, setSaves] = useState<any[]>([]);
    const [loadingSaves, setLoadingSaves] = useState(false);

    // Custom scenarios
    const [customScenarios, setCustomScenarios] = useState<ScenarioConfig[]>([]);

    useEffect(() => {
        loadCustomScenarios();
    }, []);

    const loadCustomScenarios = async () => {
        try {
            const res = await fetch('/api/storage?key=custom_scenarios');
            const data = await res.json();
            if (data && Array.isArray(data)) {
                setCustomScenarios(data);
            }
        } catch (e) {
            console.error('Failed to load custom scenarios', e);
        }
    };

    const saveCustomScenarios = async (scenarios: ScenarioConfig[]) => {
        setCustomScenarios(scenarios);
        try {
            await fetch('/api/storage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'custom_scenarios', value: scenarios }),
            });
        } catch (e) {
            console.error('Failed to save custom scenarios', e);
        }
    };

    useEffect(() => {
        if (activeTab === 'load') {
            loadSavedGames();
        }
    }, [activeTab]);

    const loadSavedGames = async () => {
        setLoadingSaves(true);
        try {
            const res = await fetch('/api/storage?list=true');
            const data = await res.json();
            if (Array.isArray(data)) {
                const worldSaves = data.filter((f: any) => f.id.startsWith('surat-world-storage'));
                worldSaves.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                setSaves(worldSaves);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingSaves(false);
        }
    };

    const handleStartScenario = (scenario: ScenarioConfig) => {
        // Generate a new save ID for this game? 
        // Currently initializeScenario generates a random world ID but `active_save_key` in localStorage 
        // might still be pointing to an old save.
        // If we want a FRESH game, we should probably set a new active_save_key.

        const timestamp = new Date().getTime();
        const newSaveSlug = `game-${timestamp}`; // simple slug
        const newSaveId = `surat-world-storage-${newSaveSlug}`;

        // Set the active key BEFORE initializing
        if (typeof window !== 'undefined') {
            localStorage.setItem('active_save_key', newSaveId);
        }

        // Clear any existing data for this key (just in case) via API? 
        // Not strictly necessary as initializeScenario overwrites the in-memory state and persists it.

        initializeScenario(scenario);
    };

    const handleImportScenario = (scenario: ScenarioConfig) => {
        // Check if already exists (by title?) - for now just add or replace if title matches
        // Actually, let's allow duplicates or maybe append (Imported) to title if desired.
        // For simplicity: just add it.
        const updated = [...customScenarios, scenario];
        saveCustomScenarios(updated);
        // We could also switch to this new scenario immediately or just show it in the list
    };

    const handleDeleteScenario = (indexToDelete: number) => {
        if (confirm('Are you sure you want to delete this scenario?')) {
            const updated = customScenarios.filter((_, i) => i !== indexToDelete);
            saveCustomScenarios(updated);
        }
    };

    const handleExportScenario = (scenario: ScenarioConfig) => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(scenario, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${scenario.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleLoadGame = (id: string) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('active_save_key', id);
            window.location.reload(); // Reload to pick up the new storage key
        }
    };

    const getDisplayName = (id: string) => {
        if (id === 'surat-world-storage') return 'Default';
        return id.replace('surat-world-storage-', '').replace(/-/g, ' ');
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 bg-zinc-950 text-zinc-100 max-w-4xl mx-auto w-full">
            <div className="w-full mb-8 text-center">
                <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                    Emergent World
                </h1>
                <p className="text-zinc-500">Select a scenario to begin or load a saved game.</p>
            </div>

            <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[500px]">
                {/* Sidebar */}
                <div className="w-full md:w-64 bg-zinc-900 border-b md:border-b-0 md:border-r border-zinc-800 flex md:flex-col">
                    <button
                        onClick={() => setActiveTab('new')}
                        className={`flex-1 py-4 md:px-6 text-left font-medium transition-colors ${activeTab === 'new' ? 'bg-zinc-800 text-blue-400 border-l-2 border-blue-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                            }`}
                    >
                        New Game
                    </button>
                    <button
                        onClick={() => setActiveTab('load')}
                        className={`flex-1 py-4 md:px-6 text-left font-medium transition-colors ${activeTab === 'load' ? 'bg-zinc-800 text-blue-400 border-l-2 border-blue-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                            }`}
                    >
                        Load Game
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 md:p-8 overflow-y-auto">
                    {activeTab === 'new' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-semibold">Start New Game</h2>
                                <button
                                    onClick={() => setShowImport(true)}
                                    className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-colors"
                                >
                                    Import JSON
                                </button>
                            </div>

                            <div className="grid gap-4">
                                {/* Default Scenario Card */}
                                <div
                                    onClick={() => handleStartScenario(defaultScenario)}
                                    className="group relative p-5 rounded-lg border border-zinc-700 bg-zinc-800/30 hover:bg-zinc-800/80 hover:border-blue-500/50 cursor-pointer transition-all"
                                >
                                    <h3 className="text-xl font-medium text-zinc-200 group-hover:text-blue-400 mb-2">
                                        {defaultScenario.title}
                                    </h3>
                                    <p className="text-sm text-zinc-400 leading-relaxed">
                                        {defaultScenario.description}
                                    </p>
                                    <div className="mt-4 flex gap-4 text-xs text-zinc-500">
                                        <span>{defaultScenario.locations.length} Locations</span>
                                        <span>{defaultScenario.characters.length} Characters</span>
                                    </div>
                                </div>

                                {/* Placeholder for custom/imported scenarios if we persist them later */}
                                {customScenarios.map((scenario, idx) => (
                                    <div
                                        key={`${scenario.title}-${idx}`}
                                        className="group relative p-5 rounded-lg border border-zinc-700 bg-zinc-800/30 hover:bg-zinc-800/80 transition-all flex flex-col gap-2"
                                    >
                                        <div
                                            onClick={() => handleStartScenario(scenario)}
                                            className="cursor-pointer"
                                        >
                                            <h3 className="text-xl font-medium text-zinc-200 group-hover:text-blue-400 mb-2">
                                                {scenario.title}
                                            </h3>
                                            <p className="text-sm text-zinc-400 leading-relaxed mb-3">
                                                {scenario.description}
                                            </p>
                                            <div className="flex gap-4 text-xs text-zinc-500">
                                                <span>{scenario.locations.length} Locations</span>
                                                <span>{scenario.characters.length} Characters</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 mt-2 pt-3 border-t border-zinc-700/50 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleExportScenario(scenario); }}
                                                className="px-2 py-1 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700"
                                            >
                                                Export
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteScenario(idx); }}
                                                className="px-2 py-1 text-xs text-red-400 hover:text-red-300 bg-zinc-800 hover:bg-red-900/30 rounded border border-zinc-700 hover:border-red-800"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'load' && (
                        <div className="space-y-4">
                            <h2 className="text-2xl font-semibold mb-6">Load Game</h2>
                            {loadingSaves ? (
                                <p className="text-zinc-500">Loading saves...</p>
                            ) : saves.length === 0 ? (
                                <p className="text-zinc-500 italic">No saved games found.</p>
                            ) : (
                                <div className="space-y-2">
                                    {saves.map((save) => (
                                        <div
                                            key={save.id}
                                            onClick={() => handleLoadGame(save.id)}
                                            className="group flex items-center justify-between p-4 rounded-lg border border-zinc-700 bg-zinc-800/30 hover:bg-zinc-800 cursor-pointer transition-all"
                                        >
                                            <div>
                                                <h3 className="font-medium text-zinc-200 group-hover:text-blue-400">
                                                    {getDisplayName(save.id)}
                                                </h3>
                                                <p className="text-xs text-zinc-500 mt-1">
                                                    Last played: {new Date(save.updatedAt).toLocaleString()}
                                                </p>
                                            </div>
                                            <svg className="text-zinc-600 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                                            </svg>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ScenarioImportDialog
                isOpen={showImport}
                onClose={() => setShowImport(false)}
                onImport={(scenario) => handleImportScenario(scenario as ScenarioConfig)}
            />
        </div>
    );
}
