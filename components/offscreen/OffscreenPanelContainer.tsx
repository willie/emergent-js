'use client';

import { useWorldStore } from '@/store/world-store';
import { OffscreenPanel } from './OffscreenPanel';

export function OffscreenPanelContainer() {
  const getOffscreenConversations = useWorldStore((s) => s.getOffscreenConversations);
  const offscreenConversations = getOffscreenConversations();

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-400">Elsewhere</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {offscreenConversations.length === 0 ? (
          <div className="p-4 text-sm text-zinc-600 text-center">
            <p>No other conversations happening right now.</p>
            <p className="mt-2 text-xs">
              When characters interact without you, their conversations will appear here.
            </p>
          </div>
        ) : (
          offscreenConversations.map((conversation) => (
            <OffscreenPanel key={conversation.id} conversationId={conversation.id} />
          ))
        )}
      </div>
    </div>
  );
}
