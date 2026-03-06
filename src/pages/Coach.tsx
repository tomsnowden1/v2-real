import { useState, useEffect, useRef } from 'react';
import { useAIProvider, isProxyMode } from '../hooks/useAIProvider';
import { Send, BrainCircuit, User, Trash2 } from 'lucide-react';
import type { AIWorkoutSuggestion } from '../lib/ai/types';
import SuggestedAction from '../components/SuggestedAction';
import ReviewCard from '../components/ReviewCard';
import { useNavigate } from 'react-router-dom';
import { useWorkout } from '../context/WorkoutContext';
import { generateId } from '../lib/id';

import { EQUIPMENT_DB } from '../db/equipment';
import { db } from '../db/database';
import type { ChatMessage, UserProfile, Exercise } from '../db/database';
import { getUserProfile } from '../db/userProfileService';
import { saveAsTemplate } from '../db/templateService';
import { addAliasToExercise, buildExerciseCatalogContext } from '../db/exerciseService';
import ResolveExercisesModal, { type ResolvedChoice } from '../components/ResolveExercisesModal';
import { resolveExerciseName, type ResolutionResult } from '../lib/exerciseResolver';
import { runReviewForWorkout } from '../lib/reviewOrchestrator';
import './Coach.css';

import { useLiveQuery } from 'dexie-react-hooks';

const GREETING_CONTENT = "Hi! I'm your IronAI Coach. Ask me to build a workout, explain an exercise, or review your progress.\n\nTry saying: *\"Build me a quick 30-minute dumbbell workout for chest and triceps\"*";

export default function Coach() {
    const { config, provider, trackUsage, isLoaded } = useAIProvider();
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { applySuggestion } = useWorkout();

    // Removed activeWorkoutId check because activeWorkouts table doesn't exist in V1 Schema
    const workouts = useLiveQuery(() => db.workoutHistory.orderBy('startTime').reverse().toArray());
    const gyms = useLiveQuery(() => db.gymProfiles.toArray());
    const allExercises = useLiveQuery(() => db.exercises.toArray(), []);
    const [profile, setProfile] = useState<UserProfile | null>(null);

    // Load chat history from Dexie (live — updates automatically when other tabs or hooks write to it)
    const storedMessages = useLiveQuery(() => db.chatMessages.orderBy('timestamp').toArray());

    // One-time migration: move localStorage coach history into Dexie
    useEffect(() => {
        const migrate = async () => {
            const saved = localStorage.getItem('ironai_coach_history');
            if (!saved) return;
            try {
                const parsed = JSON.parse(saved) as Array<{ id?: string; role: string; content: string; timestamp?: number }>;
                const now = Date.now();
                const entries: ChatMessage[] = parsed.map((m, i) => ({
                    id: m.id || generateId(),
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                    // Assign synthetic timestamps to preserve ordering for old messages without one
                    timestamp: m.timestamp ?? (now - (parsed.length - i) * 1000),
                }));
                if (entries.length > 0) {
                    await db.chatMessages.bulkPut(entries);
                }
                localStorage.removeItem('ironai_coach_history');
            } catch (e) {
                console.warn('Coach history migration failed', e);
            }
        };
        migrate();
    }, []);

    // Load profile on mount
    useEffect(() => {
        const loadProfile = async () => {
            const userProfile = await getUserProfile();
            setProfile(userProfile ?? null);
        };
        loadProfile();
    }, []);

    const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const showToast = (text: string, type: 'success' | 'error') => {
        setToastMsg({ text, type });
        setTimeout(() => setToastMsg(null), 3000);
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const [draft, setDraft] = useState('');
    const [resolvingAction, setResolvingAction] = useState<{ type: 'apply' | 'save', suggestion: AIWorkoutSuggestion, unresolvedItems: ResolutionResult[], allExercises: Exercise[] } | null>(null);

    useEffect(() => {
        scrollToBottom();
    }, [storedMessages, isLoading]);

    // Derive display messages: show virtual greeting when history is empty
    const displayMessages: ChatMessage[] = storedMessages === undefined
        ? []
        : storedMessages.length === 0
            ? [{ id: 'greeting', role: 'assistant', content: GREETING_CONTENT, timestamp: 0 }]
            : storedMessages;

    const handleClearChat = async () => {
        await db.chatMessages.clear();
        showToast("Conversation cleared", "success");
    };

    const handleRetryReview = async (workoutId: string, messageId: string) => {
        // Reset the message back to pending before re-running
        await db.chatMessages.update(messageId, { reviewStatus: 'pending', reviewData: undefined });
        runReviewForWorkout(workoutId, messageId, provider, config);
    };

    if (!isLoaded) return null;

    // The Setup UI is moved to the Settings tab in V3.
    // If no key is present, we prompt them to go there.
    if (!config.apiKey && !isProxyMode) {
        return (
            <div className="page-content coach-setup-page">
                <div className="setup-container card">
                    <div className="setup-icon-wrapper">
                        <BrainCircuit size={48} className="setup-icon" />
                    </div>
                    <h2>Activate AI Coach</h2>
                    <p className="setup-desc" style={{ marginBottom: '24px' }}>
                        IronAI connects directly to the AI provider of your choice (OpenAI, Anthropic, or Google) using your own API key.
                    </p>
                    <button
                        className="activate-btn"
                        onClick={() => navigate('/settings')}
                    >
                        Configure AI Provider
                    </button>
                </div>
            </div>
        );
    }

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!draft.trim() || (!config.apiKey && !isProxyMode)) return;

        // Guardrail: Enforce API Budget
        if (config.monthlyBudgetCap !== null && config.currentUsageUsd >= config.monthlyBudgetCap) {
            await db.chatMessages.add({
                id: generateId(),
                role: 'assistant',
                content: "⚠️ Attention: Your Monthly API Budget Cap has been reached. Please adjust your budget in Settings or wait until the next billing cycle.",
                timestamp: Date.now(),
            });
            setDraft(''); // Clear draft even if budget reached
            return;
        }

        const newUserMessage: ChatMessage = { id: generateId(), role: 'user', content: draft, timestamp: Date.now() };
        await db.chatMessages.add(newUserMessage);
        setDraft('');
        setIsLoading(true);

        try {
            // Build the Gym Context String
            let gymContextString = "";
            if (gyms && gyms.length > 0) {
                gymContextString = "The user has the following gym profiles saved:\n";
                gyms.forEach(gym => {
                    const equipmentNames = gym.availableEquipmentIds
                        .map(id => EQUIPMENT_DB.find(eq => eq.id === id)?.name)
                        .filter(Boolean)
                        .join(", ");
                    gymContextString += `- Gym Name: "${gym.name}" | Available Equipment: ${equipmentNames || "None recorded"}\n`;
                });
                gymContextString += "\n\nMANDATORY RULES FOR GYM SPECIFIC WORKOUTS:\n1. If the user asks for a workout at a specific gym listed above, you MUST ONLY suggest exercises that use the available equipment.\n2. DO NOT suggest exercises that require equipment they do not have at that specific gym.\n3. If they ask for an exercise that requires missing equipment, suggest a viable alternative using the equipment they DO have.\n4. Apply FUZZY MATCHING to the user's request. If the user asks for a workout at the 'condo gym' or 'my condo', you MUST treat that as referencing the 'condo' profile and apply its strict equipment filter.";
            }

            // Build Persona String
            let personaContext = "";
            let userPreferences = "";
            let weightContext = "";
            if (profile) {
                if (profile.coachPersona) personaContext = profile.coachPersona;
                if (profile.preferences) userPreferences = profile.preferences;

                const unit = profile.weightUnit ?? 'lbs';
                if (profile.isBeginnerNoWeights) {
                    weightContext = `User's weight unit: ${unit}. The user is a beginner — default to the empty bar (${unit === 'lbs' ? '45 lbs' : '20 kg'}) or lightest option for barbell exercises.`;
                } else if (profile.strengthBaselines && Object.keys(profile.strengthBaselines).length > 0) {
                    const b = profile.strengthBaselines;
                    const lines: string[] = [`User's weight unit: ${unit}. Comfortable 8-rep baselines:`];
                    if (b.squat) lines.push(`  Squat: ${b.squat} ${unit} × 8`);
                    if (b.benchPress) lines.push(`  Bench Press: ${b.benchPress} ${unit} × 8`);
                    if (b.deadlift) lines.push(`  Deadlift: ${b.deadlift} ${unit} × 8`);
                    if (b.overheadPress) lines.push(`  Overhead Press: ${b.overheadPress} ${unit} × 8`);
                    if (b.barbellRow) lines.push(`  Barbell Row: ${b.barbellRow} ${unit} × 8`);
                    if (b.bicepCurl) lines.push(`  Bicep Curl: ${b.bicepCurl} ${unit} × 8`);
                    weightContext = lines.join('\n');
                } else {
                    weightContext = `User's weight unit: ${unit}.`;
                }
            }

            // Build Recent Workouts String with full exercise + set data
            let recentHistoryContext = "";
            if (workouts && workouts.length > 0) {
                workouts.slice(0, 3).forEach(w => {
                    const date = new Date(w.startTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    const durationMins = Math.floor(w.durationMs / 60000);
                    recentHistoryContext += `\nWorkout: ${w.name} — ${date} (${durationMins} mins)\n`;
                    w.exercises.forEach(ex => {
                        const exName = ex.exerciseName || ex.exerciseId;
                        const doneSets = ex.sets.filter(s => s.isDone);
                        if (doneSets.length === 0) {
                            recentHistoryContext += `  - ${exName}: no completed sets\n`;
                        } else {
                            const setsStr = doneSets.map((s, i) =>
                                s.weight > 0
                                    ? `Set ${i + 1}: ${s.weight} kg × ${s.reps}`
                                    : `Set ${i + 1}: ${s.reps} reps (bodyweight)`
                            ).join(', ');
                            const totalVol = doneSets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
                            recentHistoryContext += `  - ${exName}: ${setsStr} (vol: ${totalVol.toFixed(0)} kg)\n`;
                        }
                    });
                });
            }

            // Build API history — exclude review cards (structured data, not chat turns)
            const history = [...(storedMessages ?? []), newUserMessage]
                .filter(m => m.type !== 'review')
                .slice(-10)
                .map(m => ({ role: m.role, content: m.content }));

            const catalogContext = allExercises ? buildExerciseCatalogContext(allExercises) : '';

            const response = await provider.sendMessageToCoach(
                config.apiKey ?? '',
                config.selectedModel,
                history,
                gymContextString,
                personaContext,
                recentHistoryContext,
                userPreferences,
                weightContext,
                catalogContext
            );

            if (response.usage) {
                trackUsage(config.selectedModel, response.usage.promptTokens, response.usage.completionTokens);
            }

            if (response.data) {
                await db.chatMessages.add({
                    id: generateId(),
                    role: 'assistant',
                    content: response.data,
                    timestamp: Date.now(),
                });
            } else {
                await db.chatMessages.add({
                    id: generateId(),
                    role: 'assistant',
                    content: `Sorry, I had trouble reaching ${provider.name}. Please check your API key and connection in the Settings tab.`,
                    timestamp: Date.now(),
                });
            }
        } catch (error) {
            await db.chatMessages.add({
                id: generateId(),
                role: 'assistant',
                content: `Sorry, I had trouble reaching ${provider.name}. Please check your API key and connection in the Settings tab.`,
                timestamp: Date.now(),
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplySuggestion = async (suggestion: AIWorkoutSuggestion) => {
        try {
            const allExercises = await db.exercises.toArray();
            const results = suggestion.exercises.map(ex => resolveExerciseName(ex.name, allExercises));
            const unresolved = results.filter(r => r.status === 'needs_user');

            if (unresolved.length > 0) {
                setResolvingAction({ type: 'apply', suggestion, unresolvedItems: unresolved, allExercises });
                return;
            }

            const resolvedMap: Record<string, { id: string, name: string }> = {};
            for (const res of results) {
                resolvedMap[res.rawName] = { id: res.exerciseId!, name: res.dbExercise!.name };
            }

            applySuggestion(suggestion, resolvedMap);
            navigate('/workout');
        } catch (error) {
            console.error(error);
            showToast("Failed to apply workout. The AI's formatting might be corrupted.", "error");
        }
    };

    const handleSaveTemplate = async (suggestion: AIWorkoutSuggestion) => {
        try {
            const allExercises = await db.exercises.toArray();
            const results = suggestion.exercises.map(ex => resolveExerciseName(ex.name, allExercises));
            const unresolved = results.filter(r => r.status === 'needs_user');

            if (unresolved.length > 0) {
                setResolvingAction({ type: 'save', suggestion, unresolvedItems: unresolved, allExercises });
                return;
            }

            const resolvedList = results.map(r => ({ id: r.exerciseId!, name: r.dbExercise!.name }));
            await proceedSaveTemplate(suggestion, resolvedList);
        } catch (error) {
            console.error(error);
            showToast("Failed to initiate template save.", "error");
        }
    };

    const proceedSaveTemplate = async (suggestion: AIWorkoutSuggestion, resolvedList: { id: string, name: string }[]) => {
        try {
            const resolvedExercises = suggestion.exercises.map((ex, idx) => {
                const dbEx = resolvedList[idx];
                const sets = [];
                const numSets = ex.sets || 3;
                for (let i = 0; i < numSets; i++) {
                    sets.push({
                        id: `s-${generateId()}`,
                        type: 'normal' as const,
                        weight: 0,
                        reps: parseInt(ex.reps as any) || 0,
                        isDone: false
                    });
                }
                return {
                    id: `we-${generateId()}`,
                    exerciseId: dbEx.id,
                    exerciseName: dbEx.name,
                    sets
                };
            });

            await saveAsTemplate(suggestion.name, resolvedExercises);
            showToast("Template saved to your Home tab!", "success");
        } catch (error) {
            console.error(error);
            showToast("Failed to save template.", "error");
        }
    };

    const handleResolveComplete = async (choices: ResolvedChoice[]) => {
        if (!resolvingAction) return;

        const finalMap: Record<string, { id: string, name: string }> = {};

        for (const choice of choices) {
            if (choice.exerciseId === 'CUSTOM') {
                const newEx = {
                    id: `ex-custom-${generateId()}`,
                    name: choice.rawName,
                    category: 'Custom',
                    bodyPart: 'Unknown',
                    userNotes: '',
                    isCustom: true,
                    aliases: []
                };
                await db.exercises.add(newEx as any);
                finalMap[choice.rawName] = { id: newEx.id, name: newEx.name };
            } else {
                const dbEx = await db.exercises.get(choice.exerciseId);
                finalMap[choice.rawName] = { id: dbEx!.id, name: dbEx!.name };

                if (choice.shouldRemember) {
                    await addAliasToExercise(dbEx!.id, choice.rawName);
                }
            }
        }

        const { type, suggestion, allExercises } = resolvingAction;

        // Pick up the originally resolved exercises
        const results = suggestion.exercises.map(ex => resolveExerciseName(ex.name, allExercises));
        for (const res of results) {
            if (res.status === 'resolved') {
                finalMap[res.rawName] = { id: res.exerciseId!, name: res.dbExercise!.name };
            }
        }

        setResolvingAction(null);

        if (type === 'apply') {
            applySuggestion(suggestion, finalMap);
            navigate('/workout');
        } else {
            const resolvedList = suggestion.exercises.map(ex => finalMap[ex.name]);
            await proceedSaveTemplate(suggestion, resolvedList);
        }
    };

    // Active Chat UI
    return (
        <div className="page-content coach-chat-page">
            <header className="coach-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <BrainCircuit size={20} className="header-icon" />
                    <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Coach</h1>
                </div>
                <button
                    onClick={handleClearChat}
                    className="icon-btn"
                    aria-label="Clear conversation"
                    style={{ padding: '8px', color: 'var(--color-text-muted)' }}
                >
                    <Trash2 size={18} />
                </button>
            </header>

            {toastMsg && (
                <div className={`coach-toast ${toastMsg.type}`}>
                    {toastMsg.text}
                </div>
            )}

            <div className="chat-history">
                {displayMessages.map((msg) => {
                    // Review card messages get their own rich renderer
                    if (msg.type === 'review') {
                        return (
                            <div key={msg.id} className="chat-bubble-wrapper assistant">
                                <div className="chat-avatar assistant">
                                    <BrainCircuit size={16} />
                                </div>
                                <div className="chat-bubble-content-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                    <ReviewCard message={msg} onRetry={handleRetryReview} />
                                </div>
                            </div>
                        );
                    }

                    // Regular chat messages
                    let replyText = msg.content;
                    let workoutSuggestion = undefined;
                    let suggestedWorkouts: AIWorkoutSuggestion[] = [];

                    if (msg.role === 'assistant') {
                        try {
                            const parsed = JSON.parse(msg.content);
                            replyText = parsed.message || replyText;
                            workoutSuggestion = parsed.workoutSuggestion;
                            if (parsed.suggestedWorkouts) {
                                suggestedWorkouts = parsed.suggestedWorkouts;
                            }
                        } catch (e) {
                            // Not JSON — show as plain text (e.g. greeting, budget warning)
                            console.warn("Failed to parse assistant JSON", e);
                        }
                    }

                    const allSuggestions = [...(workoutSuggestion ? [workoutSuggestion] : []), ...suggestedWorkouts];

                    return (
                        <div key={msg.id} className={`chat-bubble-wrapper ${msg.role}`}>
                            <div className={`chat-avatar ${msg.role}`}>
                                {msg.role === 'assistant' ? <BrainCircuit size={16} /> : <User size={16} />}
                            </div>

                            <div className="chat-bubble-content-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                <div className={`chat-bubble ${msg.role}`}>
                                    <p style={{ whiteSpace: 'pre-wrap' }}>{replyText}</p>
                                </div>

                                {allSuggestions.map((sug, idx) => (
                                    <SuggestedAction key={idx} suggestion={sug} onApply={handleApplySuggestion} onSaveTemplate={handleSaveTemplate} />
                                ))}
                            </div>
                        </div>
                    );
                })}
                {isLoading && (
                    <div className="chat-bubble-wrapper assistant">
                        <div className="chat-avatar assistant"><BrainCircuit size={16} /></div>
                        <div className="chat-bubble assistant"><p className="typing-indicator">...</p></div>
                    </div>
                )}
                <div style={{ height: 20 }} ref={messagesEndRef}></div>
            </div>

            <form className="chat-input-area" onSubmit={handleSendMessage}>
                <input
                    type="text"
                    placeholder="Ask for a workout..."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="chat-input"
                    disabled={isLoading}
                />
                <button type="submit" className="send-btn" disabled={!draft.trim() || isLoading}>
                    <Send size={18} />
                </button>
            </form>

            {resolvingAction && (
                <ResolveExercisesModal
                    unresolvedItems={resolvingAction.unresolvedItems}
                    allExercises={resolvingAction.allExercises}
                    onComplete={handleResolveComplete}
                    onCancel={() => setResolvingAction(null)}
                />
            )}
        </div>
    );
}
