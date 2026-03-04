import { useState } from 'react';
import { X, Sparkles, Activity, CalendarDays, HeartPulse, Shuffle, MessageSquare } from 'lucide-react';
import type { UserProfile } from '../db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { generateId } from '../lib/id';
import { type CheckInAnswers, type AIWorkoutSuggestion } from '../lib/ai/types';
import { useAIProvider } from '../hooks/useAIProvider';
import { saveAsTemplate } from '../db/templateService';
import { setTargetTemplates, setWeekCheckedIn } from '../db/weeklyPlanService';
import { addAliasToExercise } from '../db/exerciseService';
import ResolveExercisesModal, { type ResolvedChoice } from '../components/ResolveExercisesModal';
import { resolveExerciseName, type ResolutionResult } from '../lib/exerciseResolver';
import type { Exercise } from '../db/database';
import './WeeklyCheckInModal.css';

interface Props {
    profile: UserProfile;
    onClose: () => void;
}

export default function WeeklyCheckInModal({ profile, onClose }: Props) {
    const { config, provider, trackUsage } = useAIProvider();

    // Step 1: Form, Step 2: Loading, Step 3: Review
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [daysAvailable, setDaysAvailable] = useState<number>(profile.targetWorkoutDays || 3);
    const [bodyStatus, setBodyStatus] = useState<string>('');
    const [variety, setVariety] = useState<CheckInAnswers['variety']>('Keep it similar');
    const [satisfaction, setSatisfaction] = useState<string>('');

    // AI Results
    const [proposedWorkouts, setProposedWorkouts] = useState<AIWorkoutSuggestion[]>([]);
    const [resolvingPlan, setResolvingPlan] = useState<{
        unresolvedItems: ResolutionResult[];
        allExercises: Exercise[];
        proposedWorkouts: AIWorkoutSuggestion[];
    } | null>(null);

    const recentHistory = useLiveQuery(() =>
        db.workoutHistory.orderBy('startTime').reverse().limit(3).toArray()
    );

    const gymProfiles = useLiveQuery(() => db.gymProfiles.toArray());

    const handleGenerate = async () => {
        if (!config.apiKey) {
            setError('API key is missing. Please configure it in your Settings.');
            return;
        }

        if (config.monthlyBudgetCap !== null && config.currentUsageUsd >= config.monthlyBudgetCap) {
            setError('Monthly API Budget Cap reached. Please adjust your budget in Settings or wait until the next billing cycle.');
            return;
        }

        setStep(2);
        setError(null);

        try {
            const answers: CheckInAnswers = {
                daysAvailable,
                bodyStatus: bodyStatus || 'Feeling good, no issues.',
                variety,
                satisfaction: satisfaction || 'It went fine.'
            };

            let equipmentContext = 'Standard commercial gym equipment.';
            if (gymProfiles && gymProfiles.length > 0) {
                const defaultGym = gymProfiles[0];
                equipmentContext = `User is at: ${defaultGym.name}. Available equipment IDs: ${defaultGym.availableEquipmentIds.join(', ')}. Do not suggest exercises that require equipment not in this list.`;
            }
            const response = await provider.generateWeeklyPlanUpdate(
                config.apiKey,
                config.selectedModel,
                profile,
                recentHistory || [],
                answers,
                equipmentContext
            );

            if (response.usage) {
                trackUsage(config.selectedModel, response.usage.promptTokens, response.usage.completionTokens);
            }

            if (response.data && response.data.length > 0) {
                setProposedWorkouts(response.data);
                setStep(3);
            } else {
                throw new Error("AI returned an empty list of workouts.");
            }

        } catch (e: any) {
            console.error('Failed to generate weekly plan', e);
            setError(e.message || 'An error occurred while communicating with IronAI.');
            setStep(1);
        }
    };

    const handleAccept = async () => {
        setStep(2); // Use loading state to block UI while evaluating
        try {
            const allExercises = await db.exercises.toArray();
            const allAiNames = Array.from(new Set(proposedWorkouts.flatMap(w => w.exercises.map(e => e.name))));

            const results = allAiNames.map(name => resolveExerciseName(name, allExercises));
            const unresolved = results.filter(r => r.status === 'needs_user');

            if (unresolved.length > 0) {
                setResolvingPlan({ unresolvedItems: unresolved, allExercises, proposedWorkouts });
                setStep(3); // Go back to step 3 so modal renders on top of the review screen
                return;
            }

            const resolvedMap: Record<string, { id: string, name: string }> = {};
            for (const res of results) {
                resolvedMap[res.rawName] = { id: res.exerciseId!, name: res.dbExercise!.name };
            }

            await proceedAccept(proposedWorkouts, resolvedMap);
        } catch (e: any) {
            console.error('Failed to validate matching', e);
            setError('Failed to validate exercises.');
            setStep(3);
        }
    };

    const proceedAccept = async (workouts: AIWorkoutSuggestion[], resolvedMap: Record<string, { id: string, name: string }>) => {
        setStep(2); // Use loading state to block UI while saving
        try {
            const newTemplateIds: string[] = [];
            for (const workout of workouts) {
                const exModels = workout.exercises.map((ex) => {
                    const dbEx = resolvedMap[ex.name];
                    const mappedSets = [];
                    for (let i = 0; i < ex.sets; i++) {
                        mappedSets.push({
                            id: `s-${generateId()}`,
                            type: 'normal' as const,
                            weight: 0,
                            reps: parseInt(ex.reps) || 0,
                            isDone: false
                        });
                    }
                    return {
                        id: `we-${generateId()}`,
                        exerciseId: dbEx.id,
                        exerciseName: dbEx.name,
                        sets: mappedSets
                    };
                });

                const savedTemplate = await saveAsTemplate(workout.name, exModels);
                newTemplateIds.push(savedTemplate.id);
            }

            await setTargetTemplates(newTemplateIds);
            await setWeekCheckedIn();

            onClose();
        } catch (e: any) {
            console.error('Failed to save templates', e);
            setError('Failed to save the generated templates.');
            setStep(3);
        }
    };

    const handleResolvePlanComplete = async (choices: ResolvedChoice[]) => {
        if (!resolvingPlan) return;
        const { proposedWorkouts: workouts, allExercises } = resolvingPlan;
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

        const allAiNames = Array.from(new Set(workouts.flatMap(w => w.exercises.map(e => e.name))));
        const results = allAiNames.map(name => resolveExerciseName(name, allExercises));
        for (const res of results) {
            if (res.status === 'resolved') {
                finalMap[res.rawName] = { id: res.exerciseId!, name: res.dbExercise!.name };
            }
        }

        setResolvingPlan(null);
        await proceedAccept(workouts, finalMap);
    };

    return (
        <div className="checkin-modal-overlay" onClick={onClose}>
            <div className="checkin-modal-content" onClick={e => e.stopPropagation()}>
                <header className="checkin-header">
                    <div className="checkin-header-left">
                        <div className="checkin-header-title">
                            <Sparkles size={20} color="var(--color-primary)" />
                            <h2>Weekly Check-in</h2>
                        </div>
                        <p className="checkin-subtitle">
                            {step === 1 && 'Calibrate your week with AI Coach'}
                            {step === 2 && 'Generating your plan...'}
                            {step === 3 && 'Review your personalized program'}
                        </p>
                    </div>
                    <button className="close-btn" onClick={async () => {
                        await setWeekCheckedIn();
                        onClose();
                    }}>
                        <X size={22} />
                    </button>
                </header>

                {/* Step Indicator */}
                <div className="checkin-steps">
                    <div className={`checkin-step-dot ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`} />
                    <div className={`checkin-step-dot ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`} />
                    <div className={`checkin-step-dot ${step === 3 ? 'active' : ''}`} />
                </div>

                <div className="checkin-body">
                    {step === 1 && (
                        <div className="checkin-form">
                            <p className="checkin-intro">Before IronAI generates your plan for the week, let's calibrate.</p>

                            {error && <div className="error-banner">{error}</div>}

                            <div className="form-group">
                                <label>
                                    <CalendarDays size={14} className="label-icon" />
                                    Training days this week
                                </label>
                                <div className="days-slider-container">
                                    <input
                                        type="range"
                                        min="1"
                                        max="7"
                                        value={daysAvailable}
                                        onChange={(e) => setDaysAvailable(parseInt(e.target.value))}
                                        className="days-slider"
                                    />
                                    <span className="days-value">{daysAvailable}</span>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>
                                    <HeartPulse size={14} className="label-icon" />
                                    Soreness, injuries, or fatigue?
                                </label>
                                <textarea
                                    className="checkin-textarea"
                                    placeholder="e.g., 'My lower back is tight' or 'Knees are sore, avoid heavy squats'"
                                    value={bodyStatus}
                                    onChange={e => setBodyStatus(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label>
                                    <MessageSquare size={14} className="label-icon" />
                                    How did last week feel?
                                </label>
                                <input
                                    type="text"
                                    className="checkin-input"
                                    placeholder="e.g., 'Great, felt strong' or 'Exhausting'"
                                    value={satisfaction}
                                    onChange={e => setSatisfaction(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label>
                                    <Shuffle size={14} className="label-icon" />
                                    Programming variety
                                </label>
                                <div className="variety-toggle">
                                    <button
                                        className={variety === 'Keep it similar' ? 'active' : ''}
                                        onClick={() => setVariety('Keep it similar')}
                                    >
                                        Keep it similar
                                    </button>
                                    <button
                                        className={variety === 'Mix it up' ? 'active' : ''}
                                        onClick={() => setVariety('Mix it up')}
                                    >
                                        Mix it up
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="checkin-loading">
                            <div className="loading-icon-wrapper">
                                <Activity size={36} className="spin-slow" color="var(--color-primary)" />
                            </div>
                            <h3>Coach is analyzing your data...</h3>
                            <p>Generating {daysAvailable} optimized templates for your '{profile.goal}' goal.</p>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="checkin-review">
                            <h3 className="review-title">
                                <Sparkles size={18} color="var(--color-primary)" />
                                Proposed Week
                            </h3>
                            <div className="proposed-list">
                                {proposedWorkouts.map((workout, i) => (
                                    <div key={i} className="proposed-card">
                                        <div className="proposed-card-header">
                                            <h4>Day {i + 1}: {workout.name}</h4>
                                            <span>{workout.exercises.length} Exercises</span>
                                        </div>
                                        <div className="proposed-card-body">
                                            {workout.exercises.slice(0, 3).map((ex, j) => (
                                                <div key={j} className="proposed-ex">
                                                    <span>{ex.sets}x {ex.name}</span>
                                                    <span className="proposed-ex-rep">({ex.reps})</span>
                                                </div>
                                            ))}
                                            {workout.exercises.length > 3 && (
                                                <div className="proposed-ex overflow">+{workout.exercises.length - 3} more</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {error && <div className="error-banner">{error}</div>}
                        </div>
                    )}
                </div>

                <div className="checkin-footer">
                    {step === 1 && (
                        <button className="primary-btn" onClick={handleGenerate}>
                            Generate Weekly Plan
                        </button>
                    )}
                    {step === 3 && (
                        <button className="primary-btn pulse-glow" onClick={handleAccept}>
                            Accept & Schedule Week
                        </button>
                    )}
                </div>
            </div>

            {resolvingPlan && (
                <ResolveExercisesModal
                    unresolvedItems={resolvingPlan.unresolvedItems}
                    allExercises={resolvingPlan.allExercises}
                    onComplete={handleResolvePlanComplete}
                    onCancel={() => setResolvingPlan(null)}
                />
            )}
        </div>
    );
}
