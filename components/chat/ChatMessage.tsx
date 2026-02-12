"use client";

import { memo, useState, useCallback } from "react";
import type { UIMessage } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageActions } from "./MessageActions";
import { isTextPart } from "@/lib/chat/message-utils";

interface ChatMessageProps {
  message: UIMessage;
  index: number;
  isLastAssistant: boolean;
  onUpdate: (id: string, content: string) => void;
  onDelete: (index: number) => void;
  onRewind: (index: number) => void;
  onRegenerate?: () => void;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  index,
  isLastAssistant,
  onUpdate,
  onDelete,
  onRewind,
  onRegenerate,
}: ChatMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  const handleEditClick = useCallback(() => {
    const textPart = message.parts.find(isTextPart);
    setEditContent(textPart ? textPart.text : "");
    setIsEditing(true);
  }, [message.parts]);

  const handleSave = useCallback(() => {
    onUpdate(message.id, editContent);
    setIsEditing(false);
  }, [editContent, onUpdate, message.id]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditContent("");
  }, []);

  const handleDelete = useCallback(() => {
    onDelete(index);
  }, [onDelete, index]);

  const handleRewind = useCallback(() => {
    onRewind(index);
  }, [onRewind, index]);

  // Hide "Continue" messages from the UI
  const textPart = message.parts.find(isTextPart);
  if (
    message.role === "user" &&
    textPart &&
    (textPart.text === "Continue" || textPart.text === "__SURAT_CONTINUE__")
  ) {
    return null;
  }

  return (
    <div
      className={`group flex ${
        message.role === "user" ? "justify-end" : "justify-start"
      }`}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-2">
          {message.role === "assistant" && (
            <MessageActions
              onEdit={handleEditClick}
              onDelete={handleDelete}
              onRewind={handleRewind}
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
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-zinc-900/50 text-zinc-100 p-2 rounded border border-zinc-700 focus:outline-none focus:border-blue-500 resize-y min-h-[100px]"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleCancel}
                    className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
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
                            <ul className="list-disc pl-4 mb-2" {...props} />
                          ),
                          ol: ({ ...props }) => (
                            <ol className="list-decimal pl-4 mb-2" {...props} />
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
              onEdit={handleEditClick}
              onDelete={handleDelete}
              onRewind={handleRewind}
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
