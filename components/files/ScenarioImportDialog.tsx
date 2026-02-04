'use client';

import { useState, useRef } from 'react';
import { ScenarioSchema, type ScenarioDefinition } from '@/types/scenario';

interface ScenarioImportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (scenario: ScenarioDefinition) => void;
}

export function ScenarioImportDialog({ isOpen, onClose, onImport }: ScenarioImportDialogProps) {
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                const result = ScenarioSchema.safeParse(json);

                if (result.success) {
                    setError(null);
                    onImport(result.data);
                    onClose();
                } else {
                    console.error(result.error);
                    setError('Invalid scenario format: ' + result.error.issues.map((e: any) => e.message).join(', '));
                }
            } catch (err) {
                setError('Invalid JSON file');
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-full max-w-md shadow-xl flex flex-col gap-4">
                <h3 className="text-xl font-medium text-zinc-100">Import Scenario</h3>

                <p className="text-sm text-zinc-400">
                    Upload a JSON file containing a valid scenario definition.
                </p>

                {error && (
                    <div className="bg-red-900/50 border border-red-800 text-red-200 text-sm p-3 rounded">
                        {error}
                    </div>
                )}

                <div className="flex justify-center border-2 border-dashed border-zinc-700 rounded-lg p-8 hover:border-zinc-500 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}>
                    <div className="text-center">
                        <p className="text-zinc-300 font-medium">Click to select file</p>
                        <p className="text-zinc-500 text-xs mt-1">.json files only</p>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".json"
                        className="hidden"
                    />
                </div>

                <div className="flex justify-end gap-2 mt-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-zinc-400 hover:text-zinc-200"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
