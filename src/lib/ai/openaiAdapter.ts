import OpenAI from 'openai';
import type { AIProvider, AIWorkoutSuggestion, CheckInAnswers, AIResponse, PostWorkoutReview } from './types';
import type { WorkoutHistory, UserProfile, Template } from '../../db/database';
import { db } from '../../db/database';
import { getBlockWeekContext } from '../../db/weeklyPlanService';

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

/**
 * Builds the Firm Architect system prompt addition for the Coach.
 * Returns an empty string if the user hasn't completed the Architect intake
 * (i.e. profile.motivation is not set). Safe to call on every Coach message.
 *
 * Inject the result into sendMessageToCoach via the personaContext parameter.
 */
export async function buildArchitectSystemPromptAddition(profile: UserProfile): Promise<string> {
    if (!profile.motivation) return '';

    const blockCtx = getBlockWeekContext(profile);
    const unit = profile.weightUnit ?? 'lbs';

    // ── Summarise last 30 days of PRs ─────────────────────────────────────────
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let prSummary = 'No PR data yet.';
    try {
        const recentPRs = await db.prs
            .where('date').aboveOrEqual(thirtyDaysAgo)
            .toArray();

        if (recentPRs.length > 0) {
            // Group by exerciseId; keep the highest 1RM per exercise
            const byExercise = new Map<string, { value: number; metric: string }>();
            for (const pr of recentPRs) {
                const existing = byExercise.get(pr.exerciseId);
                if (!existing || pr.value > existing.value) {
                    byExercise.set(pr.exerciseId, { value: pr.value, metric: pr.metric });
                }
            }
            // Resolve names and format compactly
            const lines: string[] = [];
            for (const [exerciseId, { value, metric }] of byExercise) {
                const ex = await db.exercises.get(exerciseId);
                const name = ex?.name ?? exerciseId;
                lines.push(`${name}: ${value.toFixed(1)} ${unit} (${metric})`);
            }
            if (lines.length > 0) prSummary = lines.join(', ');
        }
    } catch { /* non-critical — continue without PR data */ }

    const weekLabel = blockCtx.isIntroWeek
        ? 'Week 1 — Intro / Adaptation'
        : blockCtx.isDeloadWeek
            ? `Week ${blockCtx.currentBlockWeek} — Deload`
            : blockCtx.isPeakWeek
                ? `Week ${blockCtx.currentBlockWeek} — Peak`
                : `Week ${blockCtx.currentBlockWeek} — Building`;

    return `
══════════════════════════════════════════
FIRM ARCHITECT MODE — ACTIVE
══════════════════════════════════════════
You are acting as a Firm Architect — a structured, science-first strength coach
who owns the user's schedule. You are warm but unapologetically direct. You do
not negotiate the program mid-block without a very good reason. You explain the
"why" behind every suggestion with data.

USER'S MOTIVATION (their "why"):
"${profile.motivation}"

ACCOUNTABILITY STATEMENT:
"${profile.accountabilityStatement ?? profile.motivation}"

CURRENT TRAINING BLOCK:
${weekLabel} (volume multiplier: ${blockCtx.volumeMultiplier}x)

LAST 30 DAYS — TOP PRs:
${prSummary}

ACCOUNTABILITY RULES YOU MUST FOLLOW:
1. If the user mentions skipping, reducing frequency, changing goals, quitting,
   or anything similar, OPEN your reply by directly but warmly challenging them
   using their motivation above. Example: "You said you wanted this for
   '${profile.motivation}'. That goal doesn't disappear. Let's talk about what's
   really going on."
2. Explain the science and rationale behind every suggestion — users trust data.
3. Be direct about numbers. Never use vague language like "try more reps."
4. If they're in a deload week, reassure them: rest is part of the plan.
══════════════════════════════════════════
`;
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
        { "name": "Barbell Squat", "sets": 3, "reps": "5", "weight": "RPE 8", "targetWeight": 100, "targetReps": 5 },
        { "name": "Bench Press", "sets": 3, "reps": "8", "weight": "60kg", "targetWeight": 60, "targetReps": 8, "notes": "Focus on eccentric" }
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

WEIGHT SUGGESTION RULES:
- Always include "targetWeight" (a number) and "targetReps" (a number) for WORKING SETS ONLY.
- Do NOT include targetWeight/targetReps for warm-up exercises or cardio/bodyweight movements.
- Return targetWeight in the user's preferred unit (lbs or kg) — do NOT mix units.
- If you are just chatting and not suggesting a specific, actionable workout or program, simply omit suggestedWorkouts.
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
        userPreferences?: string,
        weightContext?: string,
        exerciseCatalogContext?: string
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

            if (weightContext) {
                fullPrompt += `\n\nUSER'S WEIGHT CONTEXT (use this for targetWeight suggestions):\n${weightContext}`;
            }

            if (exerciseCatalogContext) {
                fullPrompt += `\n\n${exerciseCatalogContext}\nIMPORTANT: Always use the EXACT exercise names from the list above. Do not invent new exercise names.`;
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

GOAL ALIGNMENT CHECK (required — include results in issues[] if misaligned):
The user's goal is "${profile.goal}". Check if their actual completed reps match the ideal rep range for that goal:
- "Strength" → ideal 3-6 reps/set. If they logged 8+ reps on main compound lifts, flag it as an issue.
- "Hypertrophy" → ideal 8-12 reps/set. If they logged 3-5 reps (too heavy) or 15+ reps (too light), flag it.
- "Fat loss/Conditioning" → 12-20 reps is fine, flag only extreme outliers.
- "Consistency/Newborn" → any rep range is acceptable, do not flag rep ranges.
If there is a mismatch, include a friendly, specific issue in the issues[] array explaining the misalignment and what to change.

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

            let parsed: PostWorkoutReview;
            try {
                parsed = JSON.parse(content) as PostWorkoutReview;
            } catch {
                console.error('OpenAI Adapter: Failed to parse review JSON. Raw content:', content.slice(0, 200));
                return { data: null };
            }
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

    async generateWeeklyCompression(
        apiKey: string,
        model: string,
        workouts: WorkoutHistory[],
        profile: UserProfile
    ): Promise<AIResponse<string>> {
        try {
            const openai = getOpenAIClient(apiKey);
            const unit = profile.weightUnit ?? 'lbs';

            // Build a compact representation of the week's workouts
            const workoutLines = workouts.map(w => {
                const date = new Date(w.startTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                const exLines = w.exercises.map(ex => {
                    const name = ex.exerciseName || ex.exerciseId;
                    const doneSets = ex.sets.filter(s => s.isDone);
                    const totalVol = doneSets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
                    const topWeight = Math.max(...doneSets.map(s => s.weight), 0);
                    const topReps = doneSets.length > 0 ? doneSets[0].reps : 0;
                    const e1rm = topWeight > 0 && topReps > 0
                        ? (topWeight * (1 + topReps / 30)).toFixed(1)
                        : '0';
                    return `${name}: ${doneSets.length} sets, top ${topWeight}${unit}x${topReps}, e1RM~${e1rm}, vol ${totalVol.toFixed(0)}`;
                }).join('; ');
                return `${w.name} (${date}): ${exLines}`;
            }).join('\n');

            const prompt = `You are a data compressor. Convert the provided workout data into a single line of metadata under 30 words.
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

            const completion = await openai.chat.completions.create({
                model: model || 'gpt-4o',
                messages: [{ role: 'system', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.3,
            });

            const content = completion.choices[0]?.message?.content;
            if (!content) return { data: null };

            const parsed = JSON.parse(content);
            return {
                data: parsed.summary || null,
                usage: {
                    promptTokens: completion.usage?.prompt_tokens ?? 0,
                    completionTokens: completion.usage?.completion_tokens ?? 0,
                },
            };
        } catch (error) {
            console.error('OpenAI Adapter Weekly Compression Error:', error);
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

            const unit = profile.weightUnit ?? 'lbs';

            // Build weight baseline context
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
                weightBaselineStr = `User's comfortable 8-rep weights (use these as your baseline, scale for goal-appropriate rep ranges):\n${lines.join('\n')}`;
            }

            // Goal-specific rep range guidance
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

            const prompt = `You are the IronAI Coach, an expert strength and conditioning AI.
The user is checking in to plan their workouts for the new week.
You need to generate ${answers.daysAvailable} distinct workout templates for them to complete this week.

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
${historyContext || "No recent history."}

CRITICAL INSTRUCTION:
Because you are configured to use JSON Mode, your ENTIRE response MUST be a valid JSON object.
Do not wrap it in markdown block quotes. Provide ONLY the JSON.

Use the EXACT following structure, returning an array of exactly ${answers.daysAvailable} workouts in the "suggestedWorkouts" array.
For each WORKING SET exercise, you MUST include "targetWeight" (a number in ${unit}) and "targetReps" (a number).
Do NOT include targetWeight/targetReps for warm-ups, cardio, or bodyweight-only movements.
Use recent workout history as the primary reference for target weights — fall back to baselines if no history exists.

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
