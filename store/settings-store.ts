import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AvailableModel, DEFAULT_MODEL, AVAILABLE_MODELS } from '@/lib/ai/models';

interface SettingsStore {
    modelId: string;
    setModelId: (id: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set) => ({
            modelId: DEFAULT_MODEL,
            setModelId: (id: string) => set({ modelId: id }),
        }),
        {
            name: 'surat-settings',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
