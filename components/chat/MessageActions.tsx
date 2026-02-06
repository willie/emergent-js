'use client';

import type { UIMessage } from '@ai-sdk/react';
import { isTextPart } from './chat-utils';

interface MessageActionsProps {
  message: UIMessage;
  messageIndex: number;
  onEdit: (messageId: string, content: string) => void;
  onDelete: (messageIndex: number) => void;
  onRewind: (messageIndex: number) => void;
}

function EditIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function RewindIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
    </svg>
  );
}

export function MessageActions({
  message,
  messageIndex,
  onEdit,
  onDelete,
  onRewind,
}: MessageActionsProps) {
  const handleEdit = () => {
    const textPart = message.parts.find(isTextPart);
    if (textPart) {
      onEdit(message.id, textPart.text);
    }
  };

  return (
    <div className="flex flex-col gap-1 mt-2 transition-all">
      <button
        onClick={handleEdit}
        className="text-zinc-500 hover:text-blue-400 transition-colors p-1"
        title="Edit message"
      >
        <EditIcon />
      </button>
      <button
        onClick={() => onDelete(messageIndex)}
        className="text-zinc-500 hover:text-red-400 transition-colors p-1"
        title="Delete message"
      >
        <DeleteIcon />
      </button>
      <button
        onClick={() => onRewind(messageIndex)}
        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
        title="Rewind to here"
      >
        <RewindIcon />
      </button>
    </div>
  );
}
