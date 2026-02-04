
export const AVAILABLE_MODELS = [
    'deepseek/deepseek-v3.1-terminus:exacto',
    'openai/gpt-oss-120b:exacto',
    'qwen/qwen3-coder:exacto',
    'moonshotai/kimi-k2-0905:exacto',
    'z-ai/glm-4.6:exacto',
] as const;

export type AvailableModel = typeof AVAILABLE_MODELS[number];

export const DEFAULT_MODEL = AVAILABLE_MODELS[0];
