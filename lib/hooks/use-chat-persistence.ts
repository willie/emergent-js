'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { UIMessage } from '@ai-sdk/react';
import { STORAGE_KEYS, getStorageKey } from '@/lib/storage/keys';

async function loadStoredMessages(): Promise<UIMessage[]> {
  try {
    const key = getStorageKey(STORAGE_KEYS.MESSAGES);
    const res = await fetch(`/api/storage?key=${key}`);
    if (!res.ok) {
      console.error('Failed to load messages:', res.status);
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) return data;

    // Migration: Check localStorage if API is empty (only for legacy)
    if (typeof window !== 'undefined' && key === STORAGE_KEYS.MESSAGES) {
      const local = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      if (local) return JSON.parse(local);
    }
    return [];
  } catch {
    return [];
  }
}

async function saveMessages(messages: UIMessage[]): Promise<void> {
  try {
    const key = getStorageKey(STORAGE_KEYS.MESSAGES);
    const res = await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: messages }),
    });
    if (!res.ok) {
      console.error('Failed to save messages:', res.status);
    }
  } catch (e) {
    console.error('Failed to save messages', e);
  }
}

async function loadProcessedTools(): Promise<Set<string>> {
  try {
    const key = getStorageKey(STORAGE_KEYS.PROCESSED_TOOLS);
    const res = await fetch(`/api/storage?key=${key}`);
    if (!res.ok) {
      console.error('Failed to load processed tools:', res.status);
      return new Set();
    }
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) return new Set(data);

    // Migration: Check localStorage if API is empty (only for legacy)
    if (typeof window !== 'undefined' && key === STORAGE_KEYS.PROCESSED_TOOLS) {
      const local = localStorage.getItem(STORAGE_KEYS.PROCESSED_TOOLS);
      if (local) return new Set(JSON.parse(local));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

async function saveProcessedTools(tools: Set<string>): Promise<void> {
  try {
    const key = getStorageKey(STORAGE_KEYS.PROCESSED_TOOLS);
    const res = await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: [...tools] }),
    });
    if (!res.ok) {
      console.error('Failed to save processed tools:', res.status);
    }
  } catch (e) {
    console.error('Failed to save processed tools', e);
  }
}

/**
 * Clears all chat-related storage for the current save slot.
 */
export async function clearChatStorage(): Promise<void> {
  const msgKey = getStorageKey(STORAGE_KEYS.MESSAGES);
  const toolsKey = getStorageKey(STORAGE_KEYS.PROCESSED_TOOLS);

  await Promise.all([
    fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: msgKey, value: [] }),
    }),
    fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: toolsKey, value: [] }),
    }),
  ]);
}

interface UseChatPersistenceOptions {
  setMessages: (messages: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) => void;
}

interface UseChatPersistenceResult {
  processedTools: React.MutableRefObject<Set<string>>;
  markToolProcessed: (key: string) => void;
  clearProcessedTool: (key: string) => void;
  isHydrated: boolean;
  clearAll: () => Promise<void>;
  persistMessages: (messages: UIMessage[]) => void;
}

/**
 * Hook to manage chat message and tool processing persistence.
 *
 * @param options.setMessages - Function to set messages from useChat
 * @returns Persistence utilities and state
 */
export function useChatPersistence({ setMessages }: UseChatPersistenceOptions): UseChatPersistenceResult {
  const processedTools = useRef<Set<string>>(new Set());
  const [isHydrated, setIsHydrated] = useState(false);

  // Load persisted messages and processed tools on mount
  useEffect(() => {
    const load = async () => {
      const storedMessages = await loadStoredMessages();
      if (storedMessages.length > 0) {
        setMessages(storedMessages);
      }
      processedTools.current = await loadProcessedTools();
      setIsHydrated(true);
    };
    load();
  }, [setMessages]);

  const markToolProcessed = useCallback((key: string) => {
    processedTools.current.add(key);
    saveProcessedTools(processedTools.current);
  }, []);

  const clearProcessedTool = useCallback((key: string) => {
    processedTools.current.delete(key);
    saveProcessedTools(processedTools.current);
  }, []);

  const persistMessages = useCallback((messages: UIMessage[]) => {
    if (isHydrated && messages.length > 0) {
      saveMessages(messages);
    }
  }, [isHydrated]);

  const clearAll = useCallback(async () => {
    await clearChatStorage();
    processedTools.current = new Set();
  }, []);

  return {
    processedTools,
    markToolProcessed,
    clearProcessedTool,
    isHydrated,
    clearAll,
    persistMessages,
  };
}
