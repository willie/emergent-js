import OpenAI from 'openai';
import { models } from '@/lib/ai/openrouter';
import type { WorldState } from '@/types/world';

// Initialize OpenAI client pointing to OpenRouter
export const openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
});

// Define tools as raw JSON Schema to avoid Zod 4 incompatibility
export const GAME_TOOLS_CUSTOM_SCHEMA: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'moveToLocation',
            description: 'Call this when the player moves to a different location. This advances time and updates their position.',
            parameters: {
                type: 'object',
                properties: {
                    destination: { type: 'string', description: 'Brief description of where they are going' },
                    narrativeTime: { type: 'string', description: 'New narrative time description. Pass empty string "" if unchanged.' },
                    accompaniedBy: { type: 'array', items: { type: 'string' }, description: 'List of other character names explicitly moving WITH the player.' }
                },
                required: ['destination', 'narrativeTime', 'accompaniedBy']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'advanceTime',
            description: 'Call this when significant time passes without movement (e.g., a long conversation, waiting)',
            parameters: {
                type: 'object',
                properties: {
                    narrativeTime: { type: 'string', description: 'New narrative time description' },
                    ticks: { type: 'number', description: 'How many time units pass. Default to 5.' }
                },
                required: ['narrativeTime', 'ticks']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'discoverCharacter',
            description: 'Call this when the player encounters or notices a new character (hidden or improvised).',
            parameters: {
                type: 'object',
                properties: {
                    characterName: { type: 'string', description: 'Name of the character being discovered' },
                    introduction: { type: 'string', description: 'How they are introduced or noticed' },
                    goals: { type: 'string', description: 'Inferred or stated goals. Pass empty string "" if unknown.' }
                },
                required: ['characterName', 'introduction', 'goals']
            }
        }
    }
];

export interface AnalyzerResult {
    toolCalls: SimpleToolCall[];
}

export interface SimpleToolCall {
    toolName: string;
    args: any;
    toolCallId: string;
}

export async function analyzePlayerIntent(
    messages: any[],
    worldState: WorldState,
): Promise<AnalyzerResult> {
    const player = worldState.characters.find(c => c.id === worldState.playerCharacterId);
    const playerLocation = worldState.locationClusters.find(l => l.id === player?.currentLocationClusterId);

    const systemPrompt = `You are the Game Logic Engine. 
Your ONLY job is to analyze the user's latest input and determine if any GAME ACTIONS need to happen.
DO NOT write a narrative response. ONLY call tools if the user tries to do something that changes the state.

Current State:
- Location: ${playerLocation?.canonicalName ?? 'Unknown'}
- Time: ${worldState.time.narrativeTime}
- Characters Here: ${worldState.characters.filter(c => c.currentLocationClusterId === player?.currentLocationClusterId && c.isDiscovered && !c.isPlayer).map(c => c.name).join(', ') || 'None'}

Tools Available:
- moveToLocation: User implies movement.
- advanceTime: User implies waiting.
- discoverCharacter: User notices someone new.

If the user is just talking, call NO tools.`;

    console.log('[Analyzer] Analyzing intent with model (Direct OpenAI):', models.fast);

    // Convert CoreMessage[] from convertToModelMessages into plain OpenAI
    // chat messages.  CoreMessages can include tool-call parts and tool-result
    // messages that don't map cleanly to the OpenAI schema, so we extract only
    // the text portions of user/assistant messages.
    const openAiMessages: any[] = [];
    for (const m of messages) {
        if (m.role === 'user' || m.role === 'assistant') {
            let text: string;
            if (typeof m.content === 'string') {
                text = m.content;
            } else if (Array.isArray(m.content)) {
                text = m.content
                    .filter((p: any) => p.type === 'text')
                    .map((p: any) => p.text)
                    .join('');
            } else {
                continue;
            }
            if (text) {
                openAiMessages.push({ role: m.role, content: text });
            }
        }
        // Skip 'tool' role messages — the analyzer doesn't need them
    }

    try {
        const completion = await openai.chat.completions.create({
            model: models.fast,
            messages: [
                { role: 'system', content: systemPrompt },
                ...openAiMessages
            ],
            tools: GAME_TOOLS_CUSTOM_SCHEMA,
            tool_choice: 'auto',
        });

        const choice = completion.choices[0];
        const toolCallsRaw = choice.message.tool_calls || [];

        const toolCalls: SimpleToolCall[] = toolCallsRaw
            .filter(tc => tc.type === 'function')
            .map(tc => ({
                toolName: tc.function.name,
                args: JSON.parse(tc.function.arguments),
                toolCallId: tc.id
            }));

        if (toolCalls.length > 0) {
            console.log('[Analyzer] Tools called:', toolCalls.map(t => t.toolName));
        }

        return { toolCalls };

    } catch (error) {
        console.error('[Analyzer] Error in direct OpenAI call:', error);
        return { toolCalls: [] };
    }
}
