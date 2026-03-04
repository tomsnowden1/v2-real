import OpenAI from 'openai';
import type { AIProvider, AIWorkoutSuggestion, CheckInAnswers, AIResponse, PostWorkoutReview } from './types';
import type { WorkoutHistory, UserProfile, Template } from '../../db/database';

/**
 * Returns an OpenAI client configured for the current mode:
 * - Proxy mode (VITE_AI_PROXY_URL set): routes through our Express server,
 *   the real key stays server-side and is never sent to the browser.
 *   VITE_AI_PROXY_URL should be the base path e.g. "/api/openai/v1"
 *   The SDK will append "/chat/completions" automatically.
 * - BYOK mode (no proxy URL): calls OpenAI directly using the user-supplied key.
 */
function getOpenAIClient(apiKey: string): OpenAI {
    const proxyBaseUrl = import.meta.env.VITE_AI_PROXY_URL as string | undefined;
    if (proxyBaseUrl) {
        // The OpenAI SDK requires an absolute URL.
        // VITE_AI_PROXY_URL is a relative path (e.g. /api/openai/v1) so we
        // resolve it against the current origin at runtime.
        const absoluteUrl = proxyBaseUrl.startsWith('/')
            ? `${window.location.origin}${proxyBaseUrl}`
            : proxyBaseUrl;
        return new OpenAI({
            apiKey: 'proxy', // placeholder — the real key is injected server-side
            baseURL: absoluteUrl,
            dangerouslyAllowBrowser: true,
        });
    }
    return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
}

const SYSTEM_PROMPT = `
You are the IronAI Coach, an expert strength and conditioning AI.
Your goal is to help the user achieve their fitness goals by providing actionable advice and workout routines.

CRITICAL INSTRUCTION:
Because you are configured to use JSON Mode, your ENTIRE response MUST be a valid JSON object.
Use the EXACT following structure for every response:

{
  "message": "Your conversational reply here",
  "suggestedWorkouts": [
    {
      "name": "Full Body Power",
      "exercises": [
        { "name": "Barbell Squat", "sets": 3, "reps": "5-8", "weight": "RPE 8" },
        { "name": "Bench Press", "sets": 3, "reps": "8-10", "weight": "60kg", "notes": "Focus on eccentric" }
      ]
    },
    {
      "name": "Active Recovery",
      "exercises": [
        { "name": "Treadmill Walk", "sets": 1, "reps": "20 mins", "weight": "Bodyweight" }
      ]
    }
  ]
}

If you are suggesting a SINGLE workout, you can also just use "workoutSuggestion" as a single object instead of the array.
If you are just chatting and not suggesting a specific, actionable workout or program, simply omit these keys. 
Make sure your JSON is valid.
`;

export const openaiProvider: AIProvider = {
    id: 'openai',
    name: 'OpenAI (GPT-4o)',

    async sendMessageToCoach(
        apiKey: string,
        model: string,
        messageHistory: { role: 'user' | 'assistant', content: string }[],
        additionalContext?: string,
        personaContext?: string,
        recentHistoryContext?: string,
        userPreferences?: string
    ): Promise<AIResponse<string>> {
        try {
            const openai = getOpenAIClient(apiKey);

            let fullPrompt = SYSTEM_PROMPT;

            if (personaContext) {
                fullPrompt += `\n\nCOACH PERSONA (Adopt this tone):\n${personaContext}`;
            }

            if (recentHistoryContext) {
                fullPrompt += `\n\nUSER'S RECENT WORKOUT HISTORY (Silent Context):\n${recentHistoryContext}`;
            }

            if (additionalContext) {
                fullPrompt += `\n\nUSER'S GYM PROFILES & EQUIPMENT CONTEXT:\n${additionalContext}`;
            }

            if (userPreferences) {
                fullPrompt += `\n\nUSER'S PREFERENCES, CONSTRAINTS, & INJURIES (STRICTLY FOLLOW THIS):\n${userPreferences}`;
            }

            const completion = await openai.chat.completions.create({
                model: model || "gpt-4o",
                messages: [
                    { role: 'system', content: fullPrompt },
                    ...messageHistory
                ],
                response_format: { type: "json_object" },
                temperature: 0.7,
            });

            return {
                data: completion.choices[0]?.message?.content || null,
                usage: {
                    promptTokens: completion.usage?.prompt_tokens || 0,
                    completionTokens: completion.usage?.completion_tokens || 0
                }
            };
        } catch (error) {
            console.error("OpenAI Adapter API Error:", error);
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
        detectedPRs?: import('./types').DetectedPR[],
        sourceTemplate?: Template | null,
        weekContext?: { completed: number; planned: number; scores: number[] }
    ): Promise<AIResponse<PostWorkoutReview>> {
        try {
            const openai = getOpenAIClient(apiKey);

            // ── Exercise breakdown with trend comparison ──────────────────────────
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

                // Per-exercise trend across up to 3 previous sessions
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

            // ── Plan adherence section ────────────────────────────────────────────
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
                    const actualReps = doneSets.length > 0
                        ? doneSets.map(s => s.reps).join('/')
                        : 'none';
                    return `  ${ex.exerciseName || ex.exerciseId}: planned ${plannedSets}×${plannedReps}reps → actual ${completedSets} sets [${actualReps}] ${setStatus}`;
                });
                // Also flag exercises in template that were skipped
                sourceTemplate.exercises.forEach(te => {
                    const done = workout.exercises.find(we => we.exerciseId === te.exerciseId);
                    if (!done) lines.push(`  ${te.exerciseName || te.exerciseId}: SKIPPED (in template, not performed)`);
                });
                adherenceStr = lines.join('\n');
            }

            // ── Week progress ─────────────────────────────────────────────────────
            const weekStr = weekContext
                ? `${weekContext.completed} of ${weekContext.planned} planned workouts completed this week.` +
                  (weekContext.scores.length > 0
                      ? ` Avg score so far: ${(weekContext.scores.reduce((a, b) => a + b, 0) / weekContext.scores.length).toFixed(0)}/100.`
                      : '')
                : 'Week context unavailable.';

            // ── PR section ────────────────────────────────────────────────────────
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

            const prompt = `You are the IronAI Coach, an expert strength and conditioning AI delivering a thorough, honest post-workout review.

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
  "reviewSummary": [
    "3 to 6 short bullet points summarising the session — each under 15 words, specific, data-driven"
  ],
  "wins": [
    "Specific win with exact numbers — reference exercise name, weight, reps"
  ],
  "issues": [
    {
      "title": "Short issue title e.g. 'Bench Press — Reps Dropped on Final Set'",
      "evidence": "Exact numbers: e.g. 'Set 3: dropped from 10 to 7 reps at 100 kg'",
      "probableCause": "Most likely reason e.g. 'insufficient rest or accumulated fatigue'",
      "nextTimeChange": "Specific actionable change e.g. 'rest 3 mins before set 3, or reduce to 97.5 kg'"
    }
  ],
  "prHighlights": [
    {
      "label": "Exercise — Metric e.g. 'Lat Pulldown — 1RM PR'",
      "value": "e.g. '76.1 kg'",
      "whyItMatters": "optional context e.g. 'First time breaking the 75 kg mark'"
    }
  ],
  "weekProgress": {
    "completed": ${weekContext?.completed ?? 0},
    "planned": ${weekContext?.planned ?? 0},
    "score": ${workout.score?.overall ?? 0},
    "scoreTrend": "optional trend string e.g. '↑ improving vs last week'",
    "nextPlannedWorkout": "optional name of next planned workout if known, else omit"
  },
  "goalProgress": [
    "1-2 observations directly tied to the user's goal (${profile.goal})"
  ],
  "takeawaysTTL": [
    {
      "category": "Load Adjustment | Form | Recovery | Programming | Nutrition",
      "statement": "Specific rule e.g. 'Reduce Bench to 97.5 kg next session — final set missed by 3 reps'",
      "confidence": "low | med | high",
      "expiresAt": "${expiryDate}",
      "appliesToExerciseIds": []
    }
  ],
  "takeawaysDurableCandidates": [
    {
      "category": "same categories as above",
      "statement": "Broader rule worth saving permanently e.g. 'Always rest 3+ mins between heavy compound sets'",
      "confidence": "low | med | high"
    }
  ]
}

Rules:
- reviewSummary: 3–6 bullets, scannable, data-specific — no generic statements
- wins: reference exact exercise names and numbers from TODAY's data
- issues: only flag meaningful regressions — avoid noise on minor fluctuations
- prHighlights: only include if prStr above contains actual PRs — otherwise set to []
- takeawaysTTL: 1–3 rules that apply to the next occurrence of this exercise or workout type (expire in 7 days)
- takeawaysDurableCandidates: 0–2 broader rules the user might want to save permanently
- Be direct and specific — no filler text, no generic advice
- Score calibrated to user's goal: ${profile.goal}`;

            const completion = await openai.chat.completions.create({
                model: model || 'gpt-4o',
                messages: [{ role: 'system', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.6,
            });

            const content = completion.choices[0]?.message?.content;
            if (!content) return { data: null };

            const parsed = JSON.parse(content) as PostWorkoutReview;
            return {
                data: parsed,
                usage: {
                    promptTokens: completion.usage?.prompt_tokens ?? 0,
                    completionTokens: completion.usage?.completion_tokens ?? 0,
                },
            };
        } catch (error) {
            console.error('OpenAI Adapter Post-Workout Review Error:', error);
            throw error;
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
            const openai = getOpenAIClient(apiKey);

            const historyContext = recentHistory.map(w =>
                `- ${w.name}: ${w.exercises.length} exercises. Score: ${w.score?.overall || 'N/A'}/100`
            ).join('\n');

            const prompt = `You are the IronAI Coach, an expert strength and conditioning AI.
The user is checking in to plan their workouts for the new week.
You need to generate ${answers.daysAvailable} distinct workout templates for them to complete this week.

User Goal: ${profile.goal}
Experience Level: ${profile.experienceLevel || 'Intermediate'}
Coach Persona: ${profile.coachPersona || 'Supportive'}
User Constraints/Injuries: ${profile.preferences || 'None specified.'}
Available Equipment: ${equipmentContext}

USER'S CHECK-IN ANSWERS:
- Days I can train this week: ${answers.daysAvailable}
- Body Status / Soreness: "${answers.bodyStatus}"
- Variety preference: "${answers.variety}"
- Last week felt: "${answers.satisfaction}"

RECENT HISTORY CONTEXT:
${historyContext || "No recent history."}

CRITICAL INSTRUCTION:
Because you are configured to use JSON Mode, your ENTIRE response MUST be a valid JSON object.
Do not wrap it in markdown block quotes. Provide ONLY the JSON.

Use the EXACT following structure, returning an array of exactly ${answers.daysAvailable} workouts in the "suggestedWorkouts" array:

{
  "suggestedWorkouts": [
    {
      "name": "Push Day (Chest, Shoulders, Triceps)",
      "exercises": [
        { "name": "Dumbbell Bench Press", "sets": 3, "reps": "8-12", "weight": "RPE 8", "notes": "Control the eccentric" }
      ]
    }
  ]
}

Adjust volume, intensity, and exercise selection based on their soreness, availability, and goal.
`;

            const completion = await openai.chat.completions.create({
                model: model || "gpt-4o",
                messages: [{ role: 'system', content: prompt }],
                response_format: { type: "json_object" },
                temperature: 0.7,
            });

            const content = completion.choices[0]?.message?.content;
            if (!content) return { data: [] };

            const parsed = JSON.parse(content);
            return {
                data: parsed.suggestedWorkouts || [],
                usage: {
                    promptTokens: completion.usage?.prompt_tokens || 0,
                    completionTokens: completion.usage?.completion_tokens || 0
                }
            };
        } catch (error) {
            console.error("OpenAI Adapter Weekly Plan Generator Error:", error);
            throw error;
        }
    }
};
