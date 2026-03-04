/**
 * Represents the cost in USD per 1 Million tokens.
 */
interface ModelCost {
    inputCostPer1M: number;
    outputCostPer1M: number;
}

const MODEL_COSTS: Record<string, ModelCost> = {
    // OpenAI
    'gpt-4o': { inputCostPer1M: 5.00, outputCostPer1M: 15.00 },
    'gpt-4o-mini': { inputCostPer1M: 0.15, outputCostPer1M: 0.60 },

    // Anthropic
    'claude-3-5-sonnet': { inputCostPer1M: 3.00, outputCostPer1M: 15.00 },
    'claude-3-opus': { inputCostPer1M: 15.00, outputCostPer1M: 75.00 },

    // Gemini
    'gemini-1.5-pro': { inputCostPer1M: 3.50, outputCostPer1M: 10.50 },
    'gemini-1.5-flash': { inputCostPer1M: 0.075, outputCostPer1M: 0.30 }
};

export function calculateCostStatus(modelId: string, promptTokens = 0, completionTokens = 0): number {
    const costProfile = MODEL_COSTS[modelId];
    if (!costProfile) {
        // Fallback to a moderately conservative estimate if unknown
        return ((promptTokens / 1_000_000) * 3.00) + ((completionTokens / 1_000_000) * 15.00);
    }

    const inputCost = (promptTokens / 1_000_000) * costProfile.inputCostPer1M;
    const outputCost = (completionTokens / 1_000_000) * costProfile.outputCostPer1M;
    return inputCost + outputCost;
}
