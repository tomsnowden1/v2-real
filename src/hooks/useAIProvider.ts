
import { useState, useEffect } from 'react';
import { PROVIDERS, DEFAULT_PROVIDER_ID, PROVIDER_MODELS } from '../lib/ai';
import type { AIProvider } from '../lib/ai/types';


const AI_CONFIG_STORAGE = 'ironai_ai_config';

// True when the app is deployed with a server-side proxy.
// Friends testing the hosted build don't need to supply their own API key.
export const isProxyMode = !!(import.meta.env.VITE_AI_PROXY_URL as string | undefined);

export interface AIConfig {
    providerId: string;
    apiKey: string | null;
    selectedModel: string;
    monthlyBudgetCap: number | null;
    currentUsageUsd: number;
    lastUsageResetDate: number;
}

const DEFAULT_CONFIG: AIConfig = {
    providerId: DEFAULT_PROVIDER_ID,
    apiKey: null,
    selectedModel: PROVIDER_MODELS[DEFAULT_PROVIDER_ID][0].id,
    monthlyBudgetCap: null,
    currentUsageUsd: 0,
    lastUsageResetDate: Date.now()
};

export function useAIProvider() {
    const [config, setConfigState] = useState<AIConfig>(DEFAULT_CONFIG);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Migration: check for legacy openai key first
        const legacyStoredKey = localStorage.getItem('ironai_openai_key');
        const envKey = import.meta.env.VITE_OPENAI_API_KEY;

        const stored = localStorage.getItem(AI_CONFIG_STORAGE);

        let initialConfig = { ...DEFAULT_CONFIG };

        // In proxy mode the key lives on the server — skip the env/storage lookup
        if (isProxyMode) {
            initialConfig.apiKey = 'proxy'; // sentinel value; not sent to OpenAI directly
        } else if (stored) {
            try {
                const parsed = JSON.parse(stored);
                initialConfig = { ...initialConfig, ...parsed };

                // Handle monthly reset if needed
                const now = new Date();
                const resetDate = new Date(initialConfig.lastUsageResetDate || Date.now());
                if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
                    initialConfig.currentUsageUsd = 0;
                    initialConfig.lastUsageResetDate = now.getTime();
                    localStorage.setItem(AI_CONFIG_STORAGE, JSON.stringify(initialConfig));
                }
            } catch (e) {
                console.error("Failed to parse AI_CONFIG_STORAGE", e);
            }
        } else if (legacyStoredKey) {
            initialConfig.apiKey = legacyStoredKey;
        }

        // Environment variable overrides local storage for BYOK dev convenience
        if (!isProxyMode && envKey && initialConfig.providerId === 'openai') {
            initialConfig.apiKey = envKey;
        }

        setConfigState(initialConfig);
        setIsLoaded(true);
    }, []);

    const updateConfig = (updates: Partial<AIConfig>) => {
        const nextConfig = { ...config, ...updates };

        // If they switched providers, default the model
        if (updates.providerId && updates.providerId !== config.providerId) {
            nextConfig.selectedModel = PROVIDER_MODELS[updates.providerId][0].id;
        }

        // We only persist apiKey if it's not coming from .env
        const configToSave = { ...nextConfig };
        const envKey = import.meta.env.VITE_OPENAI_API_KEY;
        if (envKey && configToSave.providerId === 'openai' && configToSave.apiKey === envKey) {
            configToSave.apiKey = null; // don't write env dev keys to local storage
        }

        localStorage.setItem(AI_CONFIG_STORAGE, JSON.stringify(configToSave));
        setConfigState(nextConfig);
    };

    // Get the actual implementation class
    const provider: AIProvider = PROVIDERS[config.providerId] || PROVIDERS[DEFAULT_PROVIDER_ID];

    const trackUsage = (model: string, promptTokens: number, completionTokens: number) => {
        const PRICING: Record<string, { prompt: number, completion: number }> = {
            'gpt-4o-mini': { prompt: 0.15 / 1000000, completion: 0.60 / 1000000 },
            'gpt-4o': { prompt: 2.50 / 1000000, completion: 10.00 / 1000000 },
            'gpt-3.5-turbo': { prompt: 0.50 / 1000000, completion: 1.50 / 1000000 },
            'claude-3-5-sonnet-20240620': { prompt: 3.00 / 1000000, completion: 15.00 / 1000000 },
            'claude-3-haiku-20240307': { prompt: 0.25 / 1000000, completion: 1.25 / 1000000 },
            'gemini-1.5-pro': { prompt: 1.25 / 1000000, completion: 5.00 / 1000000 },
            'gemini-1.5-flash': { prompt: 0.075 / 1000000, completion: 0.30 / 1000000 }
        };

        const rates = PRICING[model] || PRICING['gpt-4o-mini']; // Default fallback

        const estimatedCost = (promptTokens * rates.prompt) + (completionTokens * rates.completion);
        if (estimatedCost > 0) {
            updateConfig({ currentUsageUsd: (config.currentUsageUsd || 0) + estimatedCost });
        }
    };

    return {
        config,
        updateConfig,
        trackUsage,
        provider,
        isLoaded
    };
}
