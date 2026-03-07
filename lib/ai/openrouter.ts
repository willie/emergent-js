import { createOpenRouter } from '@openrouter/ai-sdk-provider';

// Hard bypass for testing to avoid issues with Turbopack env evaluation
export const openrouter = createOpenRouter({
  apiKey: 'dummy',
});

export const models = [
  { id: 'dummy-model', name: 'Dummy Model' }
];
