import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useWorkout } from '../context/WorkoutContext';
import { useNavigate } from 'react-router-dom';
import { useAIProvider } from '../hooks/useAIProvider';
import { useWorkoutTimer } from '../hooks/useWorkoutTimer';
import { usePostWorkoutReview } from '../hooks/usePostWorkoutReview';
import ExerciseCard from '../components/ExerciseCard';
import ReplaceModal from '../components/ReplaceModal';
import ConfirmModal from '../components/ConfirmModal';
import FinishWorkoutSheet, { type TemplateUpdateMode } from '../components/FinishWorkoutSheet';
import { saveAsTemplate } from '../db/templateService';
import { db } from '../db/database';
import { getUserProfile } from '../db/userProfileService';
import { findOrCreateExerciseByName } from '../db/exerciseService';
import { generateId } from '../lib/id';
import { Plus, Play, Dumbbell, Bookmark } from 'lucide-react';
import './WorkoutLogger.css';

export default function WorkoutLogger() {
    const {
        isActive,
        workoutName,
        exercises,
        startTime,
        sourceTemplateId,
        startWorkout,
        updateWorkoutName,
        updateExercises,
        finishWorkout,
        cancelWorkout
    } = useWorkout();
    const { config, provider } = useAIProvider();
    const navigate = useNavigate();
    const userProfile = useLiveQuery(() => getUserProfile().then(p => p || null));
    const weightSuggestionUI = userProfile?.weightSuggestionUI ?? 'autofill';
    const weightUnit = userProfile?.weightUnit ?? 'lbs';

    // Extracted hooks
    const elapsedStr = useWorkoutTimer(isActive, startTime);
    const {
        hasChangesFromTemplate,
        templateName,
        handleFinish,
    } = usePostWorkoutReview({ exercises, sourceTemplateId, config, provider, finishWorkout });

    // Modal states
    const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
    const [exerciseToReplace, setExerciseToReplace] = useState<string | null>(null);
    const [isFinishSheetOpen, setIsFinishSheetOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

    const handleSupersetUnlink = (sourceExId: string) => {
        const sourceEx = exercises.find(e => e.id === sourceExId);
        const groupId = sourceEx?.supersetId;
        const newExs = exercises.map(ex => {
            if (ex.supersetId === groupId) {
                const { supersetId: _, ...rest } = ex;
                return rest;
            }
            return ex;
        });
        updateExercises(newExs);
    };

    // Handle Empty State (No active workout)
    if (!isActive || !startTime) {
        return (
            <div className="page-content empty-state">
                <Dumbbell size={64} color="var(--color-border)" className="empty-state-icon" />
                <h1 className="empty-state-title">Ready to work?</h1>
                <p className="empty-state-description">Start an empty workout or head to the Coach tab to get an AI-generated routine.</p>
                <button
                    onClick={() => startWorkout()}
                    className="start-workout-btn"
                >
                    Start Empty Workout
                </button>
            </div>
        );
    }

    const handleMoveUp = (index: number) => {
        if (index === 0) return;
        const newExs = [...exercises];
        [newExs[index - 1], newExs[index]] = [newExs[index], newExs[index - 1]];
        updateExercises(newExs);
    };

    const handleMoveDown = (index: number) => {
        if (index === exercises.length - 1) return;
        const newExs = [...exercises];
        [newExs[index], newExs[index + 1]] = [newExs[index + 1], newExs[index]];
        updateExercises(newExs);
    };

    const openReplaceModal = (exerciseId: string | null) => {
        setExerciseToReplace(exerciseId);
        setIsReplaceModalOpen(true);
    };

    const handleReplace = async (newName: string) => {
        setIsReplaceModalOpen(false);
        const dbEx = await findOrCreateExerciseByName(newName);

        if (exerciseToReplace) {
            const newExs = exercises.map(ex =>
                ex.id === exerciseToReplace ? { ...ex, exerciseId: dbEx.id, exerciseName: dbEx.name } : ex
            );
            updateExercises(newExs);
        } else {
            // It's an Add operation, let's fetch previous data for this exercise ID
            let previousStr = '-';
            try {
                const history = await db.workoutHistory.orderBy('startTime').reverse().limit(5).toArray();
                for (const hw of history) {
                    const found = hw.exercises.find(e => e.exerciseId === dbEx.id);
                    if (found && found.sets.length > 0) {
                        // Display the best/heaviest set they did last time
                        const bestSet = [...found.sets].sort((a, b) => b.weight - a.weight)[0];
                        if (bestSet && bestSet.weight > 0) {
                            previousStr = `${bestSet.weight}x${bestSet.reps} `;
                        } else if (bestSet && bestSet.reps > 0) {
                            previousStr = `${bestSet.reps} reps`;
                        }
                        break;
                    }
                }
            } catch (e) {
                console.error("Failed to query history for previous set format", e);
            }

            const newEx = {
                id: `we-${generateId()}`,
                exerciseId: dbEx.id,
                exerciseName: dbEx.name,
                sets: [{ id: `s-${generateId()}`, type: 'normal' as const, weight: 0, reps: 0, isDone: false, previousStr }]
            };
            updateExercises([...exercises, newEx]);
        }

        setExerciseToReplace(null);
    };

    return (
        <div className="workout-page">
            <header className="workout-header">
                <div className="workout-title-container">
                    <input
                        type="text"
                        className="workout-title-input"
                        value={workoutName}
                        onChange={(e) => updateWorkoutName(e.target.value)}
                    />
                    <div className="workout-subtitle">
                        <span className="timer"><Play size={12} className="play-icon-inline" /> {elapsedStr}</span>
                    </div>
                </div>
                <button className="finish-btn" onClick={() => setIsFinishSheetOpen(true)}>
                    Finish
                </button>
            </header>

            <div className="workout-body">
                {exercises.length === 0 ? (
                    <div className="exercises-empty">
                        No exercises yet. Click below to add one.
                    </div>
                ) : (
                    exercises.map((ex, idx) => {
                        const mappedSets = ex.sets.map(s => {
                            // Autofill: pre-populate weight/reps from AI target if the set is empty
                            const shouldAutofill = weightSuggestionUI === 'autofill'
                                && s.type === 'normal'
                                && s.weight === 0
                                && s.targetWeight !== undefined;
                            return {
                                ...s,
                                weight: shouldAutofill ? String(s.targetWeight) : s.weight.toString(),
                                reps: shouldAutofill && s.targetReps !== undefined
                                    ? String(s.targetReps)
                                    : s.reps.toString(),
                            };
                        });
                        const otherExercises = exercises
                            .filter((_, i) => i !== idx)
                            .map(e => ({ id: e.id, exerciseId: e.exerciseId, exerciseName: e.exerciseName || e.exerciseId }));

                        return (
                            <ExerciseCard
                                key={ex.id}
                                name={ex.exerciseName || ex.exerciseId}
                                exerciseId={ex.exerciseId}
                                supersetId={ex.supersetId}
                                otherExercises={otherExercises}
                                weightSuggestionUI={weightSuggestionUI}
                                weightUnit={weightUnit}
                                onTitleClick={() => navigate(`/exercises/${ex.exerciseId}`)}
                                initialSets={mappedSets}
                                onSwapClick={() => openReplaceModal(ex.id)}
                                onMoveUp={idx > 0 ? () => handleMoveUp(idx) : undefined}
                                onMoveDown={idx < exercises.length - 1 ? () => handleMoveDown(idx) : undefined}
                                onSetsChange={(newSets) => {
                                    const contextSets = newSets.map(s => ({
                                        ...s,
                                        weight: Number(s.weight) || 0,
                                        reps: Number(s.reps) || 0
                                    }));
                                    const newExs = [...exercises];
                                    newExs[idx] = { ...newExs[idx], sets: contextSets };
                                    updateExercises(newExs);
                                }}
                                onSupersetChange={(newSupersetId, targetExerciseId) => {
                                    if (newSupersetId === null) {
                                        handleSupersetUnlink(ex.id);
                                    } else if (targetExerciseId) {
                                        const newExs = exercises.map(e => {
                                            if (e.id === ex.id || e.id === targetExerciseId) {
                                                return { ...e, supersetId: newSupersetId };
                                            }
                                            return e;
                                        });
                                        updateExercises(newExs);
                                    }
                                }}
                            />
                        );
                    })
                )}

                <button className="add-exercise-btn" onClick={() => openReplaceModal(null)}>
                    <Plus size={20} />
                    Add Exercise
                </button>

                <div className="exercises-list-controls">
                    <button
                        className="add-exercise-btn save-template-btn"
                        onClick={() => setIsTemplateModalOpen(true)}
                    >
                        <Bookmark size={20} />
                        Save as Template
                    </button>
                    <button
                        className="cancel-workout-btn cancel-btn-inline"
                        onClick={() => setIsCancelModalOpen(true)}
                    >
                        Cancel
                    </button>
                </div>
            </div>

            <div className="page-spacer"></div>

            <ReplaceModal
                isOpen={isReplaceModalOpen}
                isAdd={!exerciseToReplace}
                onClose={() => setIsReplaceModalOpen(false)}
                onReplace={handleReplace}
            />

            <FinishWorkoutSheet
                isOpen={isFinishSheetOpen}
                workoutName={workoutName}
                elapsedStr={elapsedStr}
                sourceTemplateId={sourceTemplateId}
                templateName={templateName}
                hasApiKey={!!config.apiKey}
                hasChangesFromTemplate={hasChangesFromTemplate}
                onFinish={async (templateUpdateMode: TemplateUpdateMode, sendToCoach: boolean) => {
                    setIsFinishSheetOpen(false);
                    const goToCoach = await handleFinish(templateUpdateMode, sendToCoach);
                    navigate(goToCoach ? '/coach' : '/');
                }}
                onCancel={() => setIsFinishSheetOpen(false)}
            />

            <ConfirmModal
                isOpen={isCancelModalOpen}
                title="Cancel Workout?"
                message="All current progress will be lost. Are you sure you want to cancel?"
                confirmText="Yes, Cancel"
                isDestructive={true}
                onConfirm={() => {
                    setIsCancelModalOpen(false);
                    cancelWorkout();
                    navigate('/');
                }}
                onCancel={() => setIsCancelModalOpen(false)}
            />

            <ConfirmModal
                isOpen={isTemplateModalOpen}
                title="Save as Template?"
                message={`This will save "${workoutName}" to your Templates library, allowing you to quickly boot it up next time.`}
                confirmText="Save Template"
                onConfirm={async () => {
                    setIsTemplateModalOpen(false);
                    await saveAsTemplate(workoutName, exercises);
                    alert("Template saved!");
                }}
                onCancel={() => setIsTemplateModalOpen(false)}
            />

        </div>
    );
}
