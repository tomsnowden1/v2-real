import type { WorkoutHistory, UserProfile, Template } from '../../db/database';

// ------------------------------------------------------------------
// Core Domain Types
// ------------------------------------------------------------------

export type AIWorkoutSuggestion = {
    name: string;
    exercises: {
        name: string;
        sets: number;
        reps: string;
        weight: string;
        notes?: string;
    }[];
};

export type DetectedPR = {
    exerciseName: string;
    metric: string; // e.g. '1RM', 'Max Weight', 'Max Volume'
    value: number;
};

// ------------------------------------------------------------------
// Post-Workout Review — Rich V2 Structure
// ------------------------------------------------------------------

export type ReviewIssue = {
    title: string;           // e.g. "Bench Press — Final Set Drop"
    evidence: string;        // exact numbers: "dropped 10→7 reps on set 3 at 100 kg"
    probableCause: string;   // "accumulated fatigue from previous exercise"
    nextTimeChange: string;  // "reduce by 2.5 kg or add 1 min rest before final set"
};

export type PRHighlight = {
    label: string;           // e.g. "Lat Pulldown — 1RM PR"
    value: string;           // e.g. "76.1 kg"
    whyItMatters?: string;   // e.g. "First time breaking the 75 kg barrier"
};

export type TakeawayTTL = {
    category: string;                    // 'Load Adjustment' | 'Form' | 'Recovery' | 'Programming'
    statement: string;                   // actionable advice
    confidence: 'low' | 'med' | 'high';
    expiresAt: string;                   // ISO date string (7 days from now)
    appliesToExerciseIds?: string[];     // if exercise-specific
};

export type TakeawayDurable = {
    category: string;
    statement: string;
    confidence: 'low' | 'med' | 'high';
};

export type PostWorkoutReview = {
    reviewSummary: string[];             // 3–6 scannable bullets (TL;DR)
    wins: string[];                      // specific wins with numbers
    issues: ReviewIssue[];               // each with cause + recommended change
    prHighlights: PRHighlight[];         // PR callouts with context
    weekProgress: {
        completed: number;
        planned: number;
        score: number;                   // avg score this week (0–100)
        scoreTrend?: string;             // e.g. "↑ +5 from last week"
        nextPlannedWorkout?: string;     // e.g. "Pull Day (Back, Biceps)"
    };
    goalProgress: string[];              // goal-specific observations
    takeawaysTTL: TakeawayTTL[];         // auto-saved, expire in 7 days
    takeawaysDurableCandidates: TakeawayDurable[];  // user must confirm
    suggestedNextWorkoutEdits?: Array<{ kind: string; description: string; payload: unknown }>;
};

/** @deprecated Use PostWorkoutReview for new code. Kept for PostWorkoutReviewModal compat. */
export type AIPostWorkoutReview = {
    score: string;
    wins: string[];
    fails: string[];
    prs: string[];
    alternates: string[];
    nextSession: string;
    flag: string;
    insight?: string;
    nextSuggestion?: string;
    trends?: string;
    rationale?: string;
};

export type CheckInAnswers = {
    daysAvailable: number;
    bodyStatus: string;
    variety: 'Keep it similar' | 'Mix it up';
    satisfaction: string;
};

// ------------------------------------------------------------------
// Provider Interface Contract
// ------------------------------------------------------------------

export interface AIResponse<T> {
    data: T | null;
    usage?: {
        promptTokens: number;
        completionTokens: number;
    };
}

/**
 * All AI Providers (OpenAI, Anthropic, Gemini, local LLMs) must implement this interface.
 * The application layer relies strictly on these methods, abstracting away the underlying APIs.
 */
export interface AIProvider {
    /**
     * The unique identifier for this provider implementation (e.g. 'openai', 'anthropic')
     */
    id: string;

    /**
     * A human readable name for the provider UI (e.g. 'OpenAI GPT-4')
     */
    name: string;

    /**
     * Send a conversational message to the Coach and return the raw JSON string
     * representing the structured Coach response.
     */
    sendMessageToCoach(
        apiKey: string,
        model: string,
        messageHistory: { role: 'user' | 'assistant', content: string }[],
        additionalContext?: string,
        personaContext?: string,
        recentHistoryContext?: string,
        userPreferences?: string
    ): Promise<AIResponse<string>>;

    /**
     * Generates a rich structured review of the user's completed workout.
     * Includes plan adherence, trend analysis, PRs, takeaways, and week progress.
     */
    generatePostWorkoutReview(
        apiKey: string,
        model: string,
        workout: WorkoutHistory,
        profile: UserProfile,
        reviewType: 'Brief' | 'Extended',
        previousWorkouts?: WorkoutHistory[],
        detectedPRs?: DetectedPR[],
        sourceTemplate?: Template | null,
        weekContext?: { completed: number; planned: number; scores: number[] }
    ): Promise<AIResponse<PostWorkoutReview>>;

    /**
     * Generates a structural JSON array of N new templates based on the user's check-in answers.
     */
    generateWeeklyPlanUpdate(
        apiKey: string,
        model: string,
        profile: UserProfile,
        recentHistory: WorkoutHistory[],
        answers: CheckInAnswers,
        equipmentContext: string
    ): Promise<AIResponse<AIWorkoutSuggestion[]>>;
}
