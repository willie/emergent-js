'use client';

import { useState, useEffect, useCallback } from 'react';
import type { UIMessage } from '@ai-sdk/react';
import { STORAGE_KEYS, getStorageKey } from '@/lib/storage/keys';
import { api } from '@/lib/api/client';

async function loadStoredMessages(): Promise<UIMessage[]> {
  try {
    const key = getStorageKey(STORAGE_KEYS.MESSAGES);
    const data = await api.storage.get(key);
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
    await api.storage.set(key, messages);
  } catch (e) {
    console.error('Failed to save messages', e);
  }
}

/**
 * Clears all chat-related storage for the current save slot.
 */
export async function clearChatStorage(): Promise<void> {
  const msgKey = getStorageKey(STORAGE_KEYS.MESSAGES);
  await api.storage.set(msgKey, []);
}

interface UseChatPersistenceOptions<T extends UIMessage = UIMessage> {
  setMessages: (messages: T[] | ((prev: T[]) => T[])) => void;
}

interface UseChatPersistenceResult {
  isHydrated: boolean;
  persistMessages: (messages: UIMessage[]) => void;
}

/**
 * Hook to manage chat message persistence.
 */
export function useChatPersistence<T extends UIMessage = UIMessage>({ setMessages }: UseChatPersistenceOptions<T>): UseChatPersistenceResult {
  const [isHydrated, setIsHydrated] = useState(false);

  // Load persisted messages on mount
  useEffect(() => {
    const load = async () => {
      const storedMessages = await loadStoredMessages();
      if (storedMessages.length > 0) {
        setMessages(storedMessages as T[]);
      }
      setIsHydrated(true);
    };
    load();
  }, [setMessages]);

  const persistMessages = useCallback((messages: UIMessage[]) => {
    if (isHydrated && messages.length > 0) {
      saveMessages(messages);
    }
  }, [isHydrated]);

  return {
    isHydrated,
    persistMessages,
  };
}
