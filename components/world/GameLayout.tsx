'use client';

import { LocationHeader } from './LocationHeader';
import { WorldClock } from './WorldClock';
import { MainChatPanel } from '@/components/chat/MainChatPanel';
import { OffscreenPanelContainer } from '@/components/offscreen/OffscreenPanelContainer';

export function GameLayout() {
  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100">
      {/* Header with location and time */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <LocationHeader />
        <WorldClock />
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main chat panel - takes majority of space */}
        <main className="flex-1 flex flex-col min-w-0">
          <MainChatPanel />
        </main>

        {/* Off-screen panels - sidebar */}
        <aside className="w-96 border-l border-zinc-800 overflow-hidden flex flex-col">
          <OffscreenPanelContainer />
        </aside>
      </div>
    </div>
  );
}
