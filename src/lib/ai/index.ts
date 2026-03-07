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
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', tags: ['Balanced'] },
        { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', tags: ['High Quality'] },
        { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', tags: ['Fast', 'Low Cost'] }
    ],
    'gemini': [
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', tags: ['Large Context'] },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', tags: ['Fast', 'Low Cost'] }
    ]
};
