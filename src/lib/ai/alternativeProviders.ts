import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIProvider, AIWorkoutSuggestion, CheckInAnswers, PostWorkoutReview, AIResponse, DetectedPR } from './types';
import type { WorkoutHistory, UserProfile, Template } from '../../db/database';

// ─────────────────────────────────────────────────────────────────────────────
// Shared prompt builders (same logic as openaiAdapter — keeps responses
// consistent regardless of which provider is selected)
// ─────────────────────────────────────────────────────────────────────────────

const COACH_SYSTEM_PROMPT = `
You are the IronAI Coach, an expert strength and conditioning AI.
Your goal is to help the user achieve their fitness goals by providing actionable advice and workout routines.

CRITICAL INSTRUCTION:
Your ENTIRE response MUST be a valid JSON object with NO markdown, no code fences, no preamble.
Use the EXACT following structure for every response:

{
  "message": "Your conversational reply here",
  "suggestedWorkouts": [
    {
      "name": "Full Body Power",
      "exercises": [
        { "name": "Barbell Squat", "sets": 3, "reps": "5", "weight": "RPE 8", "targetWeight": 100, "targetReps": 5 },
        { "name": "Bench Press", "sets": 3, "reps": "8", "weight": "60kg", "targetWeight": 60, "targetReps": 8, "notes": "Focus on eccentric" }
      ]
    }
  ]
}

WEIGHT SUGGESTION RULES:
- Always include "targetWeight" (a number) and "targetReps" (a number) for WORKING SETS ONLY.
- Do NOT include targetWeight/targetReps for warm-up exercises or cardio/bodyweight movements.
- Return targetWeight in the user's preferred unit (lbs or kg) — do NOT mix units.
- If you are just chatting and not suggesting a specific workout, simply omit suggestedWorkouts.
Make sure your JSON is valid.
`;

function buildCoachSystemPrompt(
    personaContext?: string,
    recentHistoryContext?: string,
    additionalContext?: string,
    userPreferences?: string,
    weightContext?: string,
    exerciseCatalogContext?: string
): string {
    let prompt = COACH_SYSTEM_PROMPT;
    if (personaContext) prompt += `\n\nCOACH PERSONA (Adopt this tone):\n${personaContext}`;
    if (recentHistoryContext) prompt += `\n\nUSER'S RECENT WORKOUT HISTORY (Silent Context):\n${recentHistoryContext}`;
    if (additionalContext) prompt += `\n\nUSER'S GYM PROFILES & EQUIPMENT CONTEXT:\n${additionalContext}`;
    if (userPreferences) prompt += `\n\nUSER'S PREFERENCES, CONSTRAINTS, & INJURIES (STRICTLY FOLLOW THIS):\n${userPreferences}`;
    if (weightContext) prompt += `\n\nUSER'S WEIGHT CONTEXT (use this for targetWeight suggestions):\n${weightContext}`;
    if (exerciseCatalogContext) prompt += `\n\n${exerciseCatalogContext}\nIMPORTANT: Always use the EXACT exercise names from the list above.`;
    return prompt;
}

function buildReviewPrompt(
    workout: WorkoutHistory,
    profile: UserProfile,
    previousWorkouts?: WorkoutHistory[],
    detectedPRs?: DetectedPR[],
    sourceTemplate?: Template | null,
    weekContext?: { completed: number; planned: number; scores: number[] }
): string {
    const exerciseBreakdown = workout.exercises.map(ex => {
        const name = ex.exerciseName || ex.exerciseId;
        const doneSets = ex.sets.filter(s => s.isDone);
        if (doneSets.length === 0) return `${name}: no sets completed`;

        const setsStr = doneSets.map((s, i) => {
            const e1rm = s.weight > 0 && s.reps > 0
                ? ` (e1RM ≈ ${(s.weight * (1 + s.reps / 30)).toFixed(1)} kg)`
                : '';
            return `  Set ${i + 1}: ${s.weight > 0 ? `${s.weight} kg × ${s.reps}` : `${s.reps} reps (bodyweight)`}${e1rm}`;
        }).join('\n');
        const totalVol = doneSets.reduce((sum, s) => sum + (s.weight * s.reps), 0);

        let trendStr = '';
        if (previousWorkouts && previousWorkouts.length > 0) {
            const matches = previousWorkouts
                .map(pw => {
                    const prevEx = pw.exercises.find(e => e.exerciseId === ex.exerciseId);
                    if (!prevEx) return null;
                    const prevDate = new Date(pw.startTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                    const prevDone = prevEx.sets.filter(s => s.isDone);
                    const prevVol = prevDone.reduce((sum, s) => sum + (s.weight * s.reps), 0);
                    const prevSetsStr = prevDone.map((s, i) =>
                        `    Set ${i + 1}: ${s.weight > 0 ? `${s.weight} kg × ${s.reps}` : `${s.reps} reps`}`
                    ).join('\n');
                    const volDelta = totalVol - prevVol;
                    const volDeltaStr = volDelta >= 0 ? `+${volDelta.toFixed(0)} kg` : `${volDelta.toFixed(0)} kg`;
                    return `  ↳ ${prevDate}: vol ${prevVol.toFixed(0)} kg (delta: ${volDeltaStr})\n${prevSetsStr}`;
                })
                .filter(Boolean)
                .slice(0, 3);
            if (matches.length > 0) trendStr = '\n' + matches.join('\n');
        }

        return `${name} (Today vol: ${totalVol.toFixed(0)} kg):\n${setsStr}${trendStr}`;
    }).join('\n\n');

    let adherenceStr = 'No source template — free-form workout.';
    if (sourceTemplate) {
        const lines = workout.exercises.map(ex => {
            const planned = sourceTemplate.exercises.find(te => te.exerciseId === ex.exerciseId);
            if (!planned) return `  ${ex.exerciseName || ex.exerciseId}: not in template (added by user)`;
            const doneSets = ex.sets.filter(s => s.isDone);
            const plannedSets = planned.sets.length;
            const completedSets = doneSets.length;
            const setStatus = completedSets >= plannedSets ? '✓' : `✗ (${completedSets}/${plannedSets} sets)`;
            const plannedReps = planned.sets[0]?.reps ?? '?';
            const actualReps = doneSets.length > 0 ? doneSets.map(s => s.reps).join('/') : 'none';
            return `  ${ex.exerciseName || ex.exerciseId}: planned ${plannedSets}×${plannedReps}reps → actual ${completedSets} sets [${actualReps}] ${setStatus}`;
        });
        sourceTemplate.exercises.forEach(te => {
            const done = workout.exercises.find(we => we.exerciseId === te.exerciseId);
            if (!done) lines.push(`  ${te.exerciseName || te.exerciseId}: SKIPPED (in template, not performed)`);
        });
        adherenceStr = lines.join('\n');
    }

    const weekStr = weekContext
        ? `${weekContext.completed} of ${weekContext.planned} planned workouts completed this week.` +
          (weekContext.scores.length > 0
              ? ` Avg score so far: ${(weekContext.scores.reduce((a, b) => a + b, 0) / weekContext.scores.length).toFixed(0)}/100.`
              : '')
        : 'Week context unavailable.';

    const prStr = detectedPRs && detectedPRs.length > 0
        ? detectedPRs.map(pr => {
            const val = pr.metric === '1RM'
                ? `${pr.value.toFixed(1)} kg`
                : pr.metric === 'Max Volume'
                    ? `${pr.value.toFixed(0)} kg total vol`
                    : `${pr.value}`;
            return `🏆 ${pr.exerciseName} — NEW ${pr.metric}: ${val}`;
        }).join('\n')
        : 'None detected this session.';

    const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    return `You are the IronAI Coach, an expert strength and conditioning AI delivering a thorough, honest post-workout review.

USER PROFILE:
- Goal: ${profile.goal}
- Experience: ${profile.experienceLevel || 'Intermediate'}
- Coach Persona: ${profile.coachPersona || 'Supportive'}
- Constraints/Injuries: ${profile.preferences || 'None'}

WORKOUT: "${workout.name}"
Date: ${new Date(workout.startTime).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
Duration: ${Math.round(workout.durationMs / 60000)} mins
Score: ${workout.score ? `${workout.score.overall}/100 (Consistency: ${workout.score.consistency}, Progression: ${workout.score.progression}, Quality: ${workout.score.quality})` : 'N/A'}

PLAN ADHERENCE (vs source template):
${adherenceStr}

EXERCISE BREAKDOWN WITH TRENDS (previous sessions shown below each exercise):
${exerciseBreakdown}

PERSONAL RECORDS DETECTED:
${prStr}

WEEK PROGRESS:
${weekStr}

CRITICAL INSTRUCTION:
Respond ONLY with a valid JSON object — no markdown, no preamble. Use EXACTLY this structure:

{
  "reviewSummary": ["3 to 6 short bullet points summarising the session — each under 15 words, specific, data-driven"],
  "wins": ["Specific win with exact numbers — reference exercise name, weight, reps"],
  "issues": [{"title": "Short issue title", "evidence": "Exact numbers", "probableCause": "Most likely reason", "nextTimeChange": "Specific actionable change"}],
  "prHighlights": [{"label": "Exercise — Metric", "value": "e.g. '76.1 kg'", "whyItMatters": "optional context"}],
  "weekProgress": {"completed": ${weekContext?.completed ?? 0}, "planned": ${weekContext?.planned ?? 0}, "score": ${workout.score?.overall ?? 0}, "scoreTrend": "optional trend string", "nextPlannedWorkout": "optional"},
  "goalProgress": ["1-2 observations directly tied to the user's goal (${profile.goal})"],
  "takeawaysTTL": [{"category": "Load Adjustment | Form | Recovery | Programming | Nutrition", "statement": "Specific rule", "confidence": "low | med | high", "expiresAt": "${expiryDate}", "appliesToExerciseIds": []}],
  "takeawaysDurableCandidates": [{"category": "same categories", "statement": "Broader rule worth saving permanently", "confidence": "low | med | high"}]
}

Rules:
- reviewSummary: 3–6 bullets, scannable, data-specific
- wins: reference exact exercise names and numbers from TODAY's data
- issues: only flag meaningful regressions
- prHighlights: only include if prStr above contains actual PRs — otherwise set to []
- takeawaysTTL: 1–3 rules that apply to the next occurrence (expire in 7 days)
- takeawaysDurableCandidates: 0–2 broader rules
- Be direct and specific — no filler text
- Score calibrated to user's goal: ${profile.goal}`;
}

function buildWeeklyPlanPrompt(
    profile: UserProfile,
    recentHistory: WorkoutHistory[],
    answers: CheckInAnswers,
    equipmentContext: string
): string {
    const historyContext = recentHistory.map(w =>
        `- ${w.name}: ${w.exercises.length} exercises. Score: ${w.score?.overall || 'N/A'}/100`
    ).join('\n');

    const unit = profile.weightUnit ?? 'lbs';

    let weightBaselineStr = '';
    if (profile.isBeginnerNoWeights) {
        weightBaselineStr = `The user is a beginner with no baseline data. Default to the empty bar (${unit === 'lbs' ? '45 lbs' : '20 kg'}) or the lightest available option for all barbell exercises.`;
    } else if (profile.strengthBaselines && Object.keys(profile.strengthBaselines).length > 0) {
        const b = profile.strengthBaselines;
        const lines: string[] = [];
        if (b.squat) lines.push(`Squat: ${b.squat} ${unit} × 8`);
        if (b.benchPress) lines.push(`Bench Press: ${b.benchPress} ${unit} × 8`);
        if (b.deadlift) lines.push(`Deadlift: ${b.deadlift} ${unit} × 8`);
        if (b.overheadPress) lines.push(`Overhead Press: ${b.overheadPress} ${unit} × 8`);
        if (b.barbellRow) lines.push(`Barbell Row: ${b.barbellRow} ${unit} × 8`);
        if (b.bicepCurl) lines.push(`Bicep Curl: ${b.bicepCurl} ${unit} × 8`);
        weightBaselineStr = `User's comfortable 8-rep weights (use these as your baseline):\n${lines.join('\n')}`;
    }

    const goalRepRange = profile.goal === 'Strength'
        ? '3-6 reps at high load'
        : profile.goal === 'Hypertrophy'
            ? '8-12 reps at moderate-high load'
            : profile.goal === 'Fat loss/Conditioning'
                ? '12-20 reps at moderate load'
                : '8-12 reps (beginner/consistency focus)';

    const personalContextStr = profile.personalContext?.trim()
        ? `\nSAFETY CONSTRAINTS — USER-REPORTED (treat as hard constraints; NEVER assign exercises that stress these areas):\n${profile.personalContext.trim().slice(0, 300)}\n`
        : '';

    return `You are the IronAI Coach, an expert strength and conditioning AI.
The user is checking in to plan their workouts for the new week.
Generate ${answers.daysAvailable} distinct workout templates for them to complete this week.

User Goal: ${profile.goal} (target rep range: ${goalRepRange})
Experience Level: ${profile.experienceLevel || 'Intermediate'}
Coach Persona: ${profile.coachPersona || 'Supportive'}
User Constraints/Injuries: ${profile.preferences || 'None specified.'}
${personalContextStr}Available Equipment: ${equipmentContext}
User's Weight Unit: ${unit} — YOU MUST return all targetWeight values in ${unit}. Do NOT mix units.

${weightBaselineStr ? `STRENGTH BASELINES:\n${weightBaselineStr}\n` : ''}
WORKOUT STRUCTURE REQUIREMENT (apply to EVERY workout):
Every workout MUST contain at minimum 4 exercises structured as:
1. One main compound lift (primary mover for the session focus)
2. One primary accessory (same muscle group as the main lift)
3. One secondary accessory (supporting or antagonist muscle group)
4. One bodyweight or finisher movement (core, conditioning, or functional — ALWAYS include this slot)
NEVER generate a workout with fewer than 4 exercises.

EQUIPMENT FALLBACK RULE: If equipment for the ideal exercise is unavailable, substitute in this order:
- No barbell → use dumbbells or kettlebells
- No dumbbells → use resistance bands or bodyweight
- Slot 4 (finisher) MUST ALWAYS be a bodyweight movement regardless of gym type:
  examples: push-ups, plank variations, mountain climbers, jumping jacks, bodyweight squats, core work

USER'S CHECK-IN ANSWERS:
- Days I can train this week: ${answers.daysAvailable}
- Body Status / Soreness: "${answers.bodyStatus}"
- Variety preference: "${answers.variety}"
- Last week felt: "${answers.satisfaction}"

RECENT HISTORY CONTEXT:
${historyContext || 'No recent history.'}

CRITICAL INSTRUCTION:
Your ENTIRE response MUST be a valid JSON object with NO markdown, no code fences, no preamble.
Return an array of exactly ${answers.daysAvailable} workouts in the "suggestedWorkouts" array.
For each WORKING SET exercise, you MUST include "targetWeight" (a number in ${unit}) and "targetReps" (a number).
Do NOT include targetWeight/targetReps for warm-ups, cardio, or bodyweight-only movements.

{
  "suggestedWorkouts": [
    {
      "name": "Push Day (Chest, Shoulders, Triceps)",
      "exercises": [
        { "name": "Barbell Bench Press", "sets": 3, "reps": "${profile.goal === 'Strength' ? '5' : '10'}", "weight": "${profile.goal === 'Strength' ? '135 lbs' : '95 lbs'}", "targetWeight": ${profile.goal === 'Strength' ? 135 : 95}, "targetReps": ${profile.goal === 'Strength' ? 5 : 10}, "notes": "Control the eccentric" },
        { "name": "Incline Dumbbell Press", "sets": 3, "reps": "10", "weight": "50 lbs", "targetWeight": 50, "targetReps": 10 },
        { "name": "Lateral Raise", "sets": 3, "reps": "15", "weight": "15 lbs", "targetWeight": 15, "targetReps": 15 },
        { "name": "Push-ups", "sets": 2, "reps": "15", "weight": "bodyweight", "notes": "Finisher — go to near failure" }
      ]
    }
  ]
}`;
}

function buildCompressionPrompt(workouts: WorkoutHistory[], profile: UserProfile): string {
    const unit = profile.weightUnit ?? 'lbs';
    const workoutLines = workouts.map(w => {
        const date = new Date(w.startTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const exLines = w.exercises.map(ex => {
            const name = ex.exerciseName || ex.exerciseId;
            const doneSets = ex.sets.filter(s => s.isDone);
            const totalVol = doneSets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
            const topWeight = Math.max(...doneSets.map(s => s.weight), 0);
            const topReps = doneSets.length > 0 ? doneSets[0].reps : 0;
            const e1rm = topWeight > 0 && topReps > 0 ? (topWeight * (1 + topReps / 30)).toFixed(1) : '0';
            return `${name}: ${doneSets.length} sets, top ${topWeight}${unit}x${topReps}, e1RM~${e1rm}, vol ${totalVol.toFixed(0)}`;
        }).join('; ');
        return `${w.name} (${date}): ${exLines}`;
    }).join('\n');

    return `You are a data compressor. Convert the provided workout data into a single line of metadata under 30 words.
Format EXACTLY like this example:
[Sets: 48] | [E1RM Trends: SQ(+5${unit}), BP(-2${unit})] | [Missed: Legs] | [Fatigue: Med]

Rules:
- Count total completed sets across all workouts
- Note significant e1RM trends (up/down) for main lifts only
- Note any body parts that were planned but missed
- Estimate fatigue as Low/Med/High based on volume and performance
- Output ONLY the metadata line — no explanation, no conversation
- User's goal: ${profile.goal}
- Weight unit: ${unit}

WORKOUT DATA:
${workoutLines}

Respond with valid JSON: { "summary": "your single-line metadata here" }`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Anthropic Provider
// ─────────────────────────────────────────────────────────────────────────────

export const anthropicProvider: AIProvider = {
    id: 'anthropic',
    name: 'Anthropic (Claude)',

    async sendMessageToCoach(
        apiKey: string,
        model: string,
        messageHistory: { role: 'user' | 'assistant', content: string }[],
        additionalContext?: string,
        personaContext?: string,
        recentHistoryContext?: string,
        userPreferences?: string,
        weightContext?: string,
        exerciseCatalogContext?: string
    ): Promise<AIResponse<string>> {
        try {
            const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

            const systemPrompt = buildCoachSystemPrompt(
                personaContext, recentHistoryContext, additionalContext,
                userPreferences, weightContext, exerciseCatalogContext
            );

            // messageHistory only contains user/assistant messages (system is passed separately)
            const messages = messageHistory.map(m => ({ role: m.role, content: m.content }));

            const response = await client.messages.create({
                model: model || 'claude-sonnet-4-6',
                max_tokens: 4000,
                system: systemPrompt,
                messages,
            });

            const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
            return {
                data: text,
                usage: {
                    promptTokens: response.usage.input_tokens,
                    completionTokens: response.usage.output_tokens,
                },
            };
        } catch (error) {
            console.error('Anthropic Provider Coach Error:', error);
            throw error;
        }
    },

    async generatePostWorkoutReview(
        apiKey: string,
        model: string,
        workout: WorkoutHistory,
        profile: UserProfile,
        _reviewType: 'Brief' | 'Extended',
        previousWorkouts?: WorkoutHistory[],
        detectedPRs?: DetectedPR[],
        sourceTemplate?: Template | null,
        weekContext?: { completed: number; planned: number; scores: number[] }
    ): Promise<AIResponse<PostWorkoutReview>> {
        try {
            const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
            const prompt = buildReviewPrompt(workout, profile, previousWorkouts, detectedPRs, sourceTemplate, weekContext);

            const response = await client.messages.create({
                model: model || 'claude-sonnet-4-6',
                max_tokens: 4000,
                messages: [{ role: 'user', content: prompt }],
            });

            const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
            if (!text) return { data: null };

            const parsed = JSON.parse(text) as PostWorkoutReview;
            return {
                data: parsed,
                usage: {
                    promptTokens: response.usage.input_tokens,
                    completionTokens: response.usage.output_tokens,
                },
            };
        } catch (error) {
            console.error('Anthropic Provider Review Error:', error);
            return { data: null };
        }
    },

    async generateWeeklyCompression(
        apiKey: string,
        model: string,
        workouts: WorkoutHistory[],
        profile: UserProfile
    ): Promise<AIResponse<string>> {
        try {
            const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
            const prompt = buildCompressionPrompt(workouts, profile);

            const response = await client.messages.create({
                model: model || 'claude-sonnet-4-6',
                max_tokens: 200,
                messages: [{ role: 'user', content: prompt }],
            });

            const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
            if (!text) return { data: null };

            const parsed = JSON.parse(text);
            return {
                data: parsed.summary || null,
                usage: {
                    promptTokens: response.usage.input_tokens,
                    completionTokens: response.usage.output_tokens,
                },
            };
        } catch (error) {
            console.error('Anthropic Provider Compression Error:', error);
            return { data: null };
        }
    },

    async generateWeeklyPlanUpdate(
        apiKey: string,
        model: string,
        profile: UserProfile,
        recentHistory: WorkoutHistory[],
        answers: CheckInAnswers,
        equipmentContext: string
    ): Promise<AIResponse<AIWorkoutSuggestion[]>> {
        try {
            const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
            const prompt = buildWeeklyPlanPrompt(profile, recentHistory, answers, equipmentContext);

            const response = await client.messages.create({
                model: model || 'claude-sonnet-4-6',
                max_tokens: 4000,
                messages: [{ role: 'user', content: prompt }],
            });

            const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
            if (!text) return { data: [] };

            const parsed = JSON.parse(text);
            return {
                data: parsed.suggestedWorkouts || [],
                usage: {
                    promptTokens: response.usage.input_tokens,
                    completionTokens: response.usage.output_tokens,
                },
            };
        } catch (error) {
            console.error('Anthropic Provider Weekly Plan Error:', error);
            return { data: [] };
        }
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Provider
// ─────────────────────────────────────────────────────────────────────────────

export const geminiProvider: AIProvider = {
    id: 'gemini',
    name: 'Google (Gemini)',

    async sendMessageToCoach(
        apiKey: string,
        model: string,
        messageHistory: { role: 'user' | 'assistant', content: string }[],
        additionalContext?: string,
        personaContext?: string,
        recentHistoryContext?: string,
        userPreferences?: string,
        weightContext?: string,
        exerciseCatalogContext?: string
    ): Promise<AIResponse<string>> {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const systemPrompt = buildCoachSystemPrompt(
                personaContext, recentHistoryContext, additionalContext,
                userPreferences, weightContext, exerciseCatalogContext
            );

            const geminiModel = genAI.getGenerativeModel({
                model: model || 'gemini-1.5-flash',
                systemInstruction: systemPrompt,
                generationConfig: { responseMimeType: 'application/json' },
            });

            // Gemini uses role:'model' instead of 'assistant', and parts[] instead of content
            const history = messageHistory.slice(0, -1).map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));

            const lastMessage = messageHistory[messageHistory.length - 1]?.content ?? '';
            const chat = geminiModel.startChat({ history });
            const result = await chat.sendMessage(lastMessage);
            const text = result.response.text();

            return { data: text };
        } catch (error) {
            console.error('Gemini Provider Coach Error:', error);
            throw error;
        }
    },

    async generatePostWorkoutReview(
        apiKey: string,
        model: string,
        workout: WorkoutHistory,
        profile: UserProfile,
        _reviewType: 'Brief' | 'Extended',
        previousWorkouts?: WorkoutHistory[],
        detectedPRs?: DetectedPR[],
        sourceTemplate?: Template | null,
        weekContext?: { completed: number; planned: number; scores: number[] }
    ): Promise<AIResponse<PostWorkoutReview>> {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const prompt = buildReviewPrompt(workout, profile, previousWorkouts, detectedPRs, sourceTemplate, weekContext);

            const geminiModel = genAI.getGenerativeModel({
                model: model || 'gemini-1.5-flash',
                generationConfig: { responseMimeType: 'application/json' },
            });

            const result = await geminiModel.generateContent(prompt);
            const text = result.response.text();
            if (!text) return { data: null };

            const parsed = JSON.parse(text) as PostWorkoutReview;
            return { data: parsed };
        } catch (error) {
            console.error('Gemini Provider Review Error:', error);
            return { data: null };
        }
    },

    async generateWeeklyCompression(
        apiKey: string,
        model: string,
        workouts: WorkoutHistory[],
        profile: UserProfile
    ): Promise<AIResponse<string>> {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const prompt = buildCompressionPrompt(workouts, profile);

            const geminiModel = genAI.getGenerativeModel({
                model: model || 'gemini-1.5-flash',
                generationConfig: { responseMimeType: 'application/json' },
            });

            const result = await geminiModel.generateContent(prompt);
            const text = result.response.text();
            if (!text) return { data: null };

            const parsed = JSON.parse(text);
            return { data: parsed.summary || null };
        } catch (error) {
            console.error('Gemini Provider Compression Error:', error);
            return { data: null };
        }
    },

    async generateWeeklyPlanUpdate(
        apiKey: string,
        model: string,
        profile: UserProfile,
        recentHistory: WorkoutHistory[],
        answers: CheckInAnswers,
        equipmentContext: string
    ): Promise<AIResponse<AIWorkoutSuggestion[]>> {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const prompt = buildWeeklyPlanPrompt(profile, recentHistory, answers, equipmentContext);

            const geminiModel = genAI.getGenerativeModel({
                model: model || 'gemini-1.5-flash',
                generationConfig: { responseMimeType: 'application/json' },
            });

            const result = await geminiModel.generateContent(prompt);
            const text = result.response.text();
            if (!text) return { data: [] };

            const parsed = JSON.parse(text);
            return { data: parsed.suggestedWorkouts || [] };
        } catch (error) {
            console.error('Gemini Provider Weekly Plan Error:', error);
            return { data: [] };
        }
    },
};
