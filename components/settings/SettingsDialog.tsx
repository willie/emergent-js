'use client';

import { useSettingsStore } from '@/store/settings-store';
import { AVAILABLE_MODELS } from '@/lib/ai/models';

interface SettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
    const modelId = useSettingsStore((s) => s.modelId);
    const setModelId = useSettingsStore((s) => s.setModelId);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-full max-w-md shadow-xl animate-in fade-in zoom-in duration-200">
                <h3 className="text-xl font-medium mb-4 text-zinc-100">Settings</h3>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                        AI Model
                    </label>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                        {AVAILABLE_MODELS.map((model) => (
                            <label
                                key={model}
                                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${modelId === model
                                        ? 'bg-blue-900/20 border-blue-500/50'
                                        : 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="model"
                                    value={model}
                                    checked={modelId === model}
                                    onChange={(e) => setModelId(e.target.value)}
                                    className="w-4 h-4 text-blue-600 bg-zinc-700 border-zinc-500 focus:ring-blue-600 focus:ring-2"
                                />
                                <span className="ml-3 text-sm text-zinc-200 break-all">{model}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
