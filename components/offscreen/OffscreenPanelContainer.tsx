'use client';

import { useWorldStore } from '@/store/world-store';
import { OffscreenPanel } from './OffscreenPanel';

export function OffscreenPanelContainer() {
  const conversations = useWorldStore((s) => s.world?.conversations);

  const offscreenConversations = (conversations ?? [])
    .filter(c => c.type === 'offscreen' && c.isActive)
    .sort((a, b) => {
      const lastA = a.messages.length > 0 ? a.messages[a.messages.length - 1].timestamp : 0;
      const lastB = b.messages.length > 0 ? b.messages[b.messages.length - 1].timestamp : 0;
      return lastB - lastA;
    });

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
