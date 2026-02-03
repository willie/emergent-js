'use client';

import { useState } from 'react';
import { LocationHeader } from './LocationHeader';
import { WorldClock } from './WorldClock';
import { CharacterPanel } from './CharacterPanel';
import { MainChatPanel, clearChatStorage } from '@/components/chat/MainChatPanel';
import { OffscreenPanelContainer } from '@/components/offscreen/OffscreenPanelContainer';
import { useWorldStore } from '@/store/world-store';

type SidebarTab = 'elsewhere' | 'characters';

export function GameLayout() {
  const resetWorld = useWorldStore((s) => s.resetWorld);
  const [activeTab, setActiveTab] = useState<SidebarTab>('elsewhere');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleReset = () => {
    resetWorld();
    clearChatStorage();
    setShowResetConfirm(false);
    window.location.reload();
  };

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100">
      {/* Header with location and time */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <LocationHeader />
        <div className="flex items-center gap-6">
          <WorldClock />
          <button
            onClick={() => setShowResetConfirm(true)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            New Game
          </button>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main chat panel */}
        <main className="flex-1 flex flex-col min-w-0">
          <MainChatPanel />
        </main>

        {/* Sidebar with tabs */}
        <aside className="w-96 border-l border-zinc-800 overflow-hidden flex flex-col">
          <div className="flex border-b border-zinc-800">
            <button
              onClick={() => setActiveTab('elsewhere')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'elsewhere'
                  ? 'text-zinc-100 border-b-2 border-blue-500'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Elsewhere
            </button>
            <button
              onClick={() => setActiveTab('characters')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'characters'
                  ? 'text-zinc-100 border-b-2 border-blue-500'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Characters
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'elsewhere' ? (
              <OffscreenPanelContainer />
            ) : (
              <CharacterPanel />
            )}
          </div>
        </aside>
      </div>

      {/* Reset confirmation modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-sm">
            <h3 className="text-lg font-medium mb-2">Start New Game?</h3>
            <p className="text-sm text-zinc-400 mb-4">
              This will erase all progress and start fresh.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
