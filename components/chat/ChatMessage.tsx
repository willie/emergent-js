"use client";

import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { UIMessage } from '@ai-sdk/react';
import { MessageActions } from './MessageActions';
import { isTextPart } from '@/lib/chat/message-utils';

interface ChatMessageProps {
  message: UIMessage;
  index: number;
  isLastAssistant: boolean;
  isEditing: boolean;
  editContent: string;
  onEditContentChange: (content: string) => void;
  onEdit: (messageId: string, content: string) => void;
  onDelete: (messageIndex: number) => void;
  onRewind: (messageIndex: number) => void;
  onSaveEdit: (messageId: string) => void;
  onCancelEdit: () => void;
  onRegenerate?: () => void;
}

const ChatMessage = memo(({
  message,
  index,
  isLastAssistant,
  isEditing,
  editContent,
  onEditContentChange,
  onEdit,
  onDelete,
  onRewind,
  onSaveEdit,
  onCancelEdit,
  onRegenerate
}: ChatMessageProps) => {

  const textPart = message.parts.find(isTextPart);
  if (
    message.role === "user" &&
    textPart &&
    (textPart.text === "Continue" ||
      textPart.text === "__SURAT_CONTINUE__")
  ) {
    return null;
  }

  return (
    <div
      className={`group flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-2">
          {message.role === "assistant" && (
            <MessageActions
              message={message}
              messageIndex={index}
              onEdit={onEdit}
              onDelete={onDelete}
              onRewind={onRewind}
            />
          )}
          <div
            className={`max-w-[80%] rounded-lg px-4 py-2 ${
              message.role === "user"
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-100"
            }`}
          >
            {isEditing ? (
              <div className="flex flex-col gap-2 min-w-[300px]">
                <textarea
                  value={editContent}
                  onChange={(e) => onEditContentChange(e.target.value)}
                  className="w-full bg-zinc-900/50 text-zinc-100 p-2 rounded border border-zinc-700 focus:outline-none focus:border-blue-500 resize-y min-h-[100px]"
                  autoFocus
                  aria-label="Edit message content"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={onCancelEdit}
                    className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => onSaveEdit(message.id)}
                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              message.parts.map((part, i) => {
                if (isTextPart(part)) {
                  return (
                    <div
                      key={i}
                      className="prose prose-invert max-w-none break-words"
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ ...props }) => (
                            <p className="mb-2 last:mb-0" {...props} />
                          ),
                          a: ({ ...props }) => (
                            <a
                              className="text-blue-400 hover:underline"
                              target="_blank"
                              rel="noopener noreferrer"
                              {...props}
                            />
                          ),
                          ul: ({ ...props }) => (
                            <ul
                              className="list-disc pl-4 mb-2"
                              {...props}
                            />
                          ),
                          ol: ({ ...props }) => (
                            <ol
                              className="list-decimal pl-4 mb-2"
                              {...props}
                            />
                          ),
                          li: ({ ...props }) => (
                            <li className="mb-1" {...props} />
                          ),
                          code: ({ ...props }) => (
                            <code
                              className="bg-zinc-700/50 px-1 py-0.5 rounded text-xs font-mono"
                              {...props}
                            />
                          ),
                          pre: ({ ...props }) => (
                            <pre
                              className="bg-zinc-900/50 p-2 rounded mb-2 overflow-x-auto"
                              {...props}
                            />
                          ),
                        }}
                      >
                        {part.text}
                      </ReactMarkdown>
                    </div>
                  );
                }
                return null;
              })
            )}
          </div>
          {message.role === "user" && (
            <MessageActions
              message={message}
              messageIndex={index}
              onEdit={onEdit}
              onDelete={onDelete}
              onRewind={onRewind}
            />
          )}
        </div>
        {isLastAssistant && onRegenerate && (
          <button
            onClick={onRegenerate}
            className="self-start text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-1"
          >
            Regenerate
          </button>
        )}
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export { ChatMessage };
