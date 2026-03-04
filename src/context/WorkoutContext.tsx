import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { db, type WorkoutHistory, type WorkoutExercise } from '../db/database';
import { addCompletedWorkoutToWeek } from '../db/weeklyPlanService';
import { getUserProfile } from '../db/userProfileService';
import { calculateWorkoutScore } from '../lib/scoringEngine';
import { generateId } from '../lib/id';
import type { AIWorkoutSuggestion } from '../lib/ai/types';

interface WorkoutContextType {
    isActive: boolean;
    workoutName: string;
    exercises: WorkoutExercise[];
    startTime: number | null;
    sourceTemplateId: string | null;
    startWorkout: (name?: string, templateId?: string) => void;
    applySuggestion: (suggestion: AIWorkoutSuggestion, resolvedMap: Record<string, { id: string, name: string }>) => void;
    updateWorkoutName: (name: string) => void;
    updateExercises: (exs: WorkoutExercise[]) => void;
    finishWorkout: () => Promise<void>;
    cancelWorkout: () => void;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

const STORAGE_KEY = 'ironai_active_workout';

export function WorkoutProvider({ children }: { children: ReactNode }) {
    const [isActive, setIsActive] = useState(false);
    const [workoutName, setWorkoutName] = useState('New Workout');
    const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [sourceTemplateId, setSourceTemplateId] = useState<string | null>(null);

    // Load from local storage on mount to persist across reloads
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.isActive) {
                    setIsActive(parsed.isActive);
                    setWorkoutName(parsed.workoutName);
                    setExercises(parsed.exercises);
                    setStartTime(parsed.startTime);
                    setSourceTemplateId(parsed.sourceTemplateId || null);
                }
            } catch (e) {
                console.error("Failed to parse saved workout", e);
            }
        }
    }, []);

    // Save to local storage on every change
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            isActive,
            workoutName,
            exercises,
            startTime,
            sourceTemplateId
        }));
    }, [isActive, workoutName, exercises, startTime, sourceTemplateId]);

    const startWorkout = (name = 'Evening Workout', templateId?: string) => {
        setIsActive(true);
        setWorkoutName(name);
        setExercises([]);
        setStartTime(Date.now());
        setSourceTemplateId(templateId || null);
    };

    const applySuggestion = async (suggestion: AIWorkoutSuggestion, resolvedMap: Record<string, { id: string, name: string }>) => {
        const newExercises: WorkoutExercise[] = suggestion.exercises.map((aiSuggestion) => {
            const dbExercise = resolvedMap[aiSuggestion.name];

            // Create sets based on AI suggestion
            const sets = [];
            const numSets = aiSuggestion.sets || 3;
            for (let i = 0; i < numSets; i++) {
                sets.push({
                    id: `s-${generateId()}`,
                    type: 'normal' as const,
                    weight: 0,
                    reps: parseInt(aiSuggestion.reps) || 0,
                    isDone: false
                });
            }

            return {
                id: `we-${generateId()}`,
                exerciseId: dbExercise.id,
                exerciseName: dbExercise.name, // Temporary denormalization for easier rendering in Logger UI
                sets
            };
        });

        setIsActive(true);
        setWorkoutName(suggestion.name);
        setExercises(newExercises);
        if (!startTime) setStartTime(Date.now());
    };

    const updateWorkoutName = (name: string) => setWorkoutName(name);
    const updateExercises = (exs: WorkoutExercise[]) => setExercises(exs);

    const finishWorkout = async () => {
        if (!isActive || !startTime) return;

        const endTime = Date.now();
        const durationMs = endTime - startTime;

        const historyRecord: Omit<WorkoutHistory, 'id'> = {
            name: workoutName,
            startTime,
            endTime,
            durationMs,
            exercises
        };

        const profile = await getUserProfile();
        if (profile) {
            historyRecord.score = await calculateWorkoutScore(historyRecord, profile);
        }

        const fullRecord: WorkoutHistory = {
            ...historyRecord,
            id: `wh-${generateId()}`,
        };

        await db.workoutHistory.add(fullRecord);
        await addCompletedWorkoutToWeek(fullRecord.id);

        try {
            const { checkAndSavePRs } = await import('../db/prService');
            await checkAndSavePRs(fullRecord);
        } catch (error) {
            console.error("Failed to check and save PRs", error);
        }

        // Clear active state
        cancelWorkout();
    };

    const cancelWorkout = () => {
        setIsActive(false);
        setWorkoutName('New Workout');
        setExercises([]);
        setStartTime(null);
        setSourceTemplateId(null);
        localStorage.removeItem(STORAGE_KEY);
    };

    return (
        <WorkoutContext.Provider value={{
            isActive,
            workoutName,
            exercises,
            startTime,
            sourceTemplateId,
            startWorkout,
            applySuggestion,
            updateWorkoutName,
            updateExercises,
            finishWorkout,
            cancelWorkout
        }}>
            {children}
        </WorkoutContext.Provider>
    );
}

export function useWorkout() {
    const context = useContext(WorkoutContext);
    if (context === undefined) {
        throw new Error('useWorkout must be used within a WorkoutProvider');
    }
    return context;
}
