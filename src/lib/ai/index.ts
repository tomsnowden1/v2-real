import { openaiProvider } from './openaiAdapter';
import { anthropicProvider, geminiProvider } from './alternativeProviders';
import type { AIProvider } from './types';

export const PROVIDERS: Record<string, AIProvider> = {
    'openai': openaiProvider,
    'anthropic': anthropicProvider,
    'gemini': geminiProvider
};

export const DEFAULT_PROVIDER_ID = 'openai';

// Export models available per provider for the Settings UI
export const PROVIDER_MODELS: Record<string, { id: string, name: string, tags: string[] }[]> = {
    'openai': [
        { id: 'gpt-4o', name: 'GPT-4o', tags: ['High Quality'] },
        { id: 'gpt-4o-mini', name: 'GPT-4o-Mini', tags: ['Fast', 'Low Cost'] }
    ],
    'anthropic': [
        { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', tags: ['Balanced'] },
        { id: 'claude-3-opus', name: 'Claude 3 Opus', tags: ['High Quality'] }
    ],
    'gemini': [
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', tags: ['Large Context'] },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', tags: ['Fast'] }
    ]
};
