import type { AIProvider, AIWorkoutSuggestion, PostWorkoutReview, AIResponse } from './types';

export const anthropicProvider: AIProvider = {
    id: 'anthropic',
    name: 'Anthropic (Claude)',

    async sendMessageToCoach(
        _a: string,
        _m: string,
        _h: unknown[],
        _c1?: string,
        _c2?: string,
        _c3?: string,
        _c4?: string,
        _c5?: string
    ): Promise<AIResponse<string>> {
        // TODO: Implement Anthropic API call
        console.warn('Anthropic provider not yet fully implemented.');
        return { data: JSON.stringify({ message: 'Claude integration coming soon!' }) };
    },

    async generatePostWorkoutReview(): Promise<AIResponse<PostWorkoutReview>> {
        // TODO: Implement Anthropic API call
        return { data: null };
    },

    async generateWeeklyPlanUpdate(): Promise<AIResponse<AIWorkoutSuggestion[]>> {
        // TODO: Implement Anthropic API call
        return { data: [] };
    }
};

export const geminiProvider: AIProvider = {
    id: 'gemini',
    name: 'Google (Gemini)',

    async sendMessageToCoach(
        _a: string,
        _m: string,
        _h: unknown[],
        _c1?: string,
        _c2?: string,
        _c3?: string,
        _c4?: string,
        _c5?: string
    ): Promise<AIResponse<string>> {
        // TODO: Implement Gemini API call
        console.warn('Gemini provider not yet fully implemented.');
        return { data: JSON.stringify({ message: 'Gemini integration coming soon!' }) };
    },

    async generatePostWorkoutReview(): Promise<AIResponse<PostWorkoutReview>> {
        // TODO: Implement Gemini API call
        return { data: null };
    },

    async generateWeeklyPlanUpdate(): Promise<AIResponse<AIWorkoutSuggestion[]>> {
        // TODO: Implement Gemini API call
        return { data: [] };
    }
};
