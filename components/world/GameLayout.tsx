'use client';

import { useState } from 'react';
import { LocationHeader } from './LocationHeader';
import { WorldClock } from './WorldClock';
import { CharacterPanel } from './CharacterPanel';
import { MainChatPanel, clearChatStorage } from '@/components/chat/MainChatPanel';
import { OffscreenPanelContainer } from '@/components/offscreen/OffscreenPanelContainer';
import { useWorldStore } from '@/store/world-store';
import { ScenarioSelector } from '@/components/files/ScenarioSelector';

import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { SaveLoadDialog } from '@/components/settings/SaveLoadDialog';

type SidebarTab = 'elsewhere' | 'characters';

export function GameLayout() {
  const world = useWorldStore((s) => s.world);
  const resetWorld = useWorldStore((s) => s.resetWorld);

  // activeTab controls the content of the sidebar (Locations vs Characters)
  const [activeTab, setActiveTab] = useState<SidebarTab>('elsewhere');
  // mobileView controls what is shown on mobile: 'chat' or the 'sidebar' content
  const [mobileView, setMobileView] = useState<'chat' | 'sidebar'>('chat');
  const [showSettings, setShowSettings] = useState(false);
  const [showSaves, setShowSaves] = useState(false);

  // If no world is loaded, show the scenario selector (Main Menu)
  if (!world) {
    return <ScenarioSelector />;
  }

  const handleMobileNav = (view: 'chat' | 'locations' | 'people') => {
    if (view === 'chat') {
      setMobileView('chat');
    } else if (view === 'locations') {
      setMobileView('sidebar');
      setActiveTab('elsewhere');
    } else if (view === 'people') {
      setMobileView('sidebar');
      setActiveTab('characters');
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-zinc-950 text-zinc-100">
      {/* Header with location and time */}
      <header className="shrink-0 flex items-center px-4 py-3 md:px-6 md:py-4 border-b border-zinc-800">
        <LocationHeader
          topRight={<WorldClock />}
          bottomRight={
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowSettings(true)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap"
              >
                Settings
              </button>
              <button
                onClick={() => setShowSaves(true)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap"
              >
                Games
              </button>
            </div>
          }
        />
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main chat panel */}
        <main className={`flex-1 flex-col min-w-0 ${mobileView === 'chat' ? 'flex' : 'hidden md:flex'}`}>
          <MainChatPanel />
        </main>

        {/* Sidebar with tabs */}
        <aside className={`
            flex-col border-l border-zinc-800 overflow-hidden
            ${mobileView === 'sidebar' ? 'flex flex-1 w-full border-l-0' : 'hidden'} 
            md:flex md:w-96 md:border-l
        `}>
          {/* Desktop Tabs - Hidden on mobile because we use the bottom nav */}
          <div className="hidden md:flex border-b border-zinc-800">
            <button
              onClick={() => setActiveTab('elsewhere')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'elsewhere'
                ? 'text-zinc-100 border-b-2 border-blue-500'
                : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              Elsewhere
            </button>
            <button
              onClick={() => setActiveTab('characters')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'characters'
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

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden shrink-0 flex items-center justify-around border-t border-zinc-800 bg-zinc-950 pb-[env(safe-area-inset-bottom)]">
        <button
          onClick={() => handleMobileNav('chat')}
          className={`flex-1 py-4 text-center text-sm font-medium ${mobileView === 'chat' ? 'text-blue-500' : 'text-zinc-500'}`}
        >
          Chat
        </button>
        <button
          onClick={() => handleMobileNav('locations')}
          className={`flex-1 py-4 text-center text-sm font-medium ${mobileView === 'sidebar' && activeTab === 'elsewhere' ? 'text-blue-500' : 'text-zinc-500'}`}
        >
          Locations
        </button>
        <button
          onClick={() => handleMobileNav('people')}
          className={`flex-1 py-4 text-center text-sm font-medium ${mobileView === 'sidebar' && activeTab === 'characters' ? 'text-blue-500' : 'text-zinc-500'}`}
        >
          People
        </button>
      </nav>

      <SettingsDialog isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <SaveLoadDialog isOpen={showSaves} onClose={() => setShowSaves(false)} />
    </div>
  );
}
