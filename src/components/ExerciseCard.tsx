import { useState, useEffect } from 'react';
import SetRow from './SetRow';
import { MoreVertical, Copy, Info, Plus, ChevronUp, ChevronDown, Timer, Zap, Link, Link2Off, Trash2 } from 'lucide-react';
import { db } from '../db/database';
import { useRestTimer } from '../context/RestTimerContext';
import { generateId } from '../lib/id';
import './ExerciseCard.css';

// Temporary import for the table header icon
import { Check } from 'lucide-react';

export interface ExerciseSet {
    id: string;
    type: 'warmup' | 'normal' | 'failure' | 'drop';
    weight: string;
    reps: string;
    rpe?: string;
    isDone: boolean;
    previousStr?: string;
    targetWeight?: number; // AI-suggested weight (working sets only)
    targetReps?: number;   // AI-suggested reps (working sets only)
}

interface LoadSuggestion {
    prevWeight: number;
    prevReps: number;
    suggestedWeight: number;
    direction: 'up' | 'same' | 'down' | 'none';
}

interface ExerciseCardProps {
    name: string;
    exerciseId?: string;
    bodyPart?: string;
    category?: string;
    initialSets: ExerciseSet[];
    supersetId?: string;
    otherExercises?: { id: string; exerciseId: string; exerciseName: string }[];
    weightSuggestionUI?: 'autofill' | 'placeholder' | 'badge';
    weightUnit?: string;
    onOptionsClick?: () => void;
    onSwapClick?: () => void;
    onRemoveClick?: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onSetsChange?: (newSets: ExerciseSet[]) => void;
    onTitleClick?: () => void;
    onSupersetChange?: (supersetId: string | null, targetExerciseId?: string) => void;
}

export default function ExerciseCard({
    name,
    exerciseId,
    bodyPart,
    category,
    initialSets,
    supersetId,
    otherExercises = [],
    weightSuggestionUI = 'autofill',
    weightUnit = 'lbs',
    onOptionsClick,
    onSwapClick,
    onRemoveClick,
    onMoveUp,
    onMoveDown,
    onSetsChange,
    onTitleClick,
    onSupersetChange
}: ExerciseCardProps) {
    const [sets, setSetsState] = useState<ExerciseSet[]>(initialSets);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // ── Rest Timer (Global) ────────────────────────────────────────────────────────
    const { startTimer, skipTimer, isRunning, adjustDuration, getPreferredDuration } = useRestTimer();
    const [localPrefDuration, setLocalPrefDuration] = useState(() => exerciseId ? getPreferredDuration(exerciseId) : 90);

    const handleTimerNudge = (delta: number) => {
        const next = Math.max(15, Math.min(300, localPrefDuration + delta));
        setLocalPrefDuration(next);
        if (isRunning) {
            adjustDuration(delta);
        }
    };

    // ── Load Suggestion ─────────────────────────────────────────────────────
    const [loadSuggestion, setLoadSuggestion] = useState<LoadSuggestion | null>(null);
    const [loadLoading, setLoadLoading] = useState(false);

    useEffect(() => {
        if (!showAdvanced || !exerciseId) return;
        setLoadLoading(true);
        db.workoutHistory.orderBy('startTime').reverse().limit(10).toArray().then(history => {
            for (const workout of history) {
                const found = workout.exercises.find(e => e.exerciseId === exerciseId);
                if (found && found.sets.length > 0) {
                    const doneSets = found.sets.filter(s => s.isDone);
                    const sourceSets = doneSets.length > 0 ? doneSets : found.sets;
                    if (sourceSets.length === 0) continue;
                    const bestSet = [...sourceSets].sort((a, b) => b.weight - a.weight)[0];
                    const prevWeight = bestSet.weight;
                    const prevReps = bestSet.reps;

                    // Determine suggestion
                    const allDone = found.sets.every(s => s.isDone);
                    const noneDone = found.sets.every(s => !s.isDone);
                    let suggestedWeight = prevWeight;
                    let direction: LoadSuggestion['direction'] = 'same';
                    if (allDone && prevWeight > 0) {
                        suggestedWeight = prevWeight + 2.5;
                        direction = 'up';
                    } else if (noneDone && prevWeight > 0) {
                        suggestedWeight = Math.max(0, prevWeight - 2.5);
                        direction = 'down';
                    }

                    setLoadSuggestion({ prevWeight, prevReps, suggestedWeight, direction });
                    setLoadLoading(false);
                    return;
                }
            }
            setLoadSuggestion(null);
            setLoadLoading(false);
        }).catch(() => setLoadLoading(false));
    }, [showAdvanced, exerciseId]);

    // ── Supersets ────────────────────────────────────────────────────────────
    const [showSupersetPicker, setShowSupersetPicker] = useState(false);

    const handleLinkSuperset = (targetExerciseId: string) => {
        const newId = `ss-${generateId()}`;
        onSupersetChange?.(newId, targetExerciseId);
        setShowSupersetPicker(false);
    };

    // ── Set state management ─────────────────────────────────────────────────
    const setSets = (updater: ExerciseSet[] | ((prev: ExerciseSet[]) => ExerciseSet[])) => {
        let nextState: ExerciseSet[];
        setSetsState((prev) => {
            nextState = typeof updater === 'function' ? updater(prev) : updater;
            return nextState;
        });
        setTimeout(() => {
            if (nextState) onSetsChange?.(nextState);
        }, 0);
    };

    const updateSet = (id: string, field: keyof ExerciseSet, value: any) => {
        setSets(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const removeSet = (id: string) => {
        setSets(prev => prev.filter(s => s.id !== id));
    };

    const addSet = () => {
        const lastSet = sets[sets.length - 1];
        const newSet: ExerciseSet = {
            id: generateId(),
            type: 'normal',
            weight: lastSet ? lastSet.weight : '',
            reps: lastSet ? lastSet.reps : '',
            rpe: lastSet ? lastSet.rpe : '',
            isDone: false,
            previousStr: '-'
        };
        setSets(prev => [...prev, newSet]);
    };

    const handleSetDone = (setId: string) => {
        const set = sets.find(s => s.id === setId);
        if (!set || set.isDone) {
            // Untoggling
            updateSet(setId, 'isDone', false);
        } else {
            // Marking done — start global rest timer
            updateSet(setId, 'isDone', true);
            if (exerciseId) {
                startTimer(exerciseId, name);
            }
        }
    };

    const directionInfo = {
        up: { icon: '↑', label: 'Try pushing up', color: '#10b981' },
        same: { icon: '→', label: 'Maintain', color: '#6b7280' },
        down: { icon: '↓', label: 'Ease back a bit', color: '#f59e0b' },
        none: { icon: '–', label: 'No history', color: '#9ca3af' },
    };

    const hasSupersetLink = !!supersetId;

    return (
        <div className={`card exercise-card ${hasSupersetLink ? 'in-superset' : ''}`}>
            <div className="card-header">
                <div>
                    <h2
                        className={`exercise-title ${onTitleClick ? 'exercise-title-clickable' : ''}`}
                        onClick={onTitleClick}
                        data-clickable={!!onTitleClick}
                    >
                        {name}
                        {hasSupersetLink && (
                            <span className="superset-badge">Superset</span>
                        )}
                    </h2>
                    {(bodyPart || category) && (
                        <div className="exercise-subtitle">
                            <span className="pill">{bodyPart || 'Unknown'}</span>
                        </div>
                    )}
                </div>
                <div className="card-actions">
                    {onMoveUp && (
                        <button className="icon-btn" aria-label="Move up" onClick={onMoveUp}>
                            <ChevronUp size={20} />
                        </button>
                    )}
                    {onMoveDown && (
                        <button className="icon-btn" aria-label="Move down" onClick={onMoveDown}>
                            <ChevronDown size={20} />
                        </button>
                    )}
                    <button className="icon-btn" aria-label="Exercise details" onClick={onTitleClick}>
                        <Info size={20} />
                    </button>
                    {onRemoveClick && (
                        <button className="icon-btn" aria-label="Remove exercise" onClick={onRemoveClick}>
                            <Trash2 size={20} />
                        </button>
                    )}
                    <button className="icon-btn" aria-label="Swap exercise" onClick={onSwapClick}>
                        <Copy size={20} />
                    </button>
                    <button className="icon-btn" aria-label="Options" onClick={onOptionsClick}>
                        <MoreVertical size={20} />
                    </button>
                </div>
            </div>

            <div className="table-header">
                <div className="th-col th-set">SET</div>
                <div className="th-col th-prev">LAST</div>
                <div className="th-col th-metric">{weightUnit.toUpperCase()}</div>
                <div className="th-col th-metric">REPS</div>
                {showAdvanced && <div className="th-col th-metric rpe-col">RPE</div>}
                <div className="th-col th-actions"><Check size={14} className="done-icon" /></div>
            </div>

            <div className="sets-container">
                {sets.map((set, idx) => (
                    <SetRow
                        key={set.id}
                        index={idx + 1}
                        type={set.type}
                        previousStr={set.previousStr}
                        weight={set.weight}
                        reps={set.reps}
                        rpe={set.rpe}
                        isDone={set.isDone}
                        showRpe={showAdvanced}
                        targetWeight={set.targetWeight}
                        targetReps={set.targetReps}
                        weightSuggestionUI={weightSuggestionUI}
                        weightUnit={weightUnit}
                        onWeightChange={(val) => updateSet(set.id, 'weight', val)}
                        onRepsChange={(val) => updateSet(set.id, 'reps', val)}
                        onRpeChange={(val) => updateSet(set.id, 'rpe', val)}
                        onToggleDone={() => handleSetDone(set.id)}
                        onRemove={() => removeSet(set.id)}
                    />
                ))}
            </div>

            <div className="card-footer card-footer-flex">
                <button className="add-set-btn" onClick={addSet}>
                    <Plus size={16} /> Add Set
                </button>
                <button
                    className={`advanced-toggle-btn ${showAdvanced ? 'active' : ''}`}
                    onClick={() => { setShowAdvanced(!showAdvanced); }}
                >
                    {showAdvanced ? 'Hide Advanced' : 'Advanced Options'}
                    {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
            </div>

            {showAdvanced && (
                <div className="advanced-panel">

                    {/* ── Rest Timer ── */}
                    <div className="adv-section">
                        <div className="adv-section-header">
                            <Timer size={15} />
                            <span>Rest Timer Options</span>
                            {isRunning && (
                                <button className="adv-skip-btn" onClick={skipTimer}>Skip Current</button>
                            )}
                        </div>

                        <div className="rest-timer-body">
                            <div className="rest-timer-controls rest-timer-controls-compact">
                                <div className="rest-status-label rest-status-label-compact">
                                    Adjust rest preference for this exercise.
                                </div>
                                <div className="rest-duration-row">
                                    <button
                                        className="rest-nudge-btn"
                                        onClick={() => handleTimerNudge(-15)}
                                    >−15s</button>
                                    <span className="rest-duration-label">{localPrefDuration}s default</span>
                                    <button
                                        className="rest-nudge-btn"
                                        onClick={() => handleTimerNudge(15)}
                                    >+15s</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Load Suggestion ── */}
                    <div className="adv-section">
                        <div className="adv-section-header">
                            <Zap size={15} />
                            <span>Load Suggestion</span>
                        </div>
                        {loadLoading ? (
                            <p className="adv-hint">Loading history…</p>
                        ) : loadSuggestion ? (
                            <div className="load-suggestion-card">
                                <div className="load-prev">
                                    <span className="load-prev-label">Last session</span>
                                    <span className="load-prev-value">
                                        {loadSuggestion.prevWeight > 0
                                            ? `${loadSuggestion.prevWeight} ${weightUnit} × ${loadSuggestion.prevReps} reps`
                                            : `${loadSuggestion.prevReps} reps (BW)`}
                                    </span>
                                </div>
                                <div className={`load-arrow load-arrow-${loadSuggestion.direction}`}>
                                    {directionInfo[loadSuggestion.direction].icon}
                                </div>
                                <div className="load-suggested">
                                    <span className="load-prev-label">Try today</span>
                                    <span className={`load-prev-value load-prev-value-${loadSuggestion.direction}`}>
                                        {loadSuggestion.suggestedWeight > 0
                                            ? `${loadSuggestion.suggestedWeight} ${weightUnit}`
                                            : 'Bodyweight'}
                                    </span>
                                    <span className="load-hint-label">{directionInfo[loadSuggestion.direction].label}</span>
                                </div>
                            </div>
                        ) : (
                            <p className="adv-hint">
                                {exerciseId ? 'No history yet — log this exercise to get suggestions.' : 'Save the exercise to get suggestions.'}
                            </p>
                        )}
                    </div>

                    {/* ── Supersets ── */}
                    <div className="adv-section">
                        <div className="adv-section-header">
                            <Link size={15} />
                            <span>Superset</span>
                        </div>
                        {hasSupersetLink ? (
                            <div className="superset-linked-row">
                                <span className="superset-linked-label">Linked to superset group</span>
                                <button
                                    className="superset-unlink-btn"
                                    onClick={() => onSupersetChange?.(null)}
                                >
                                    <Link2Off size={14} /> Unlink
                                </button>
                            </div>
                        ) : (
                            <>
                                {showSupersetPicker ? (
                                    <div className="superset-picker">
                                        <p className="adv-hint adv-hint-compact">Pick an exercise to group with:</p>
                                        {otherExercises.length === 0 ? (
                                            <p className="adv-hint">Add another exercise first.</p>
                                        ) : (
                                            otherExercises.map(ex => (
                                                <button
                                                    key={ex.id}
                                                    className="superset-pick-option"
                                                    onClick={() => handleLinkSuperset(ex.id)}
                                                >
                                                    {ex.exerciseName}
                                                </button>
                                            ))
                                        )}
                                        <button className="adv-skip-btn adv-skip-btn-compact" onClick={() => setShowSupersetPicker(false)}>
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className="superset-link-btn"
                                        onClick={() => setShowSupersetPicker(true)}
                                        disabled={otherExercises.length === 0}
                                    >
                                        <Link size={14} /> Link as Superset
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                </div>
            )}
        </div>
    );
}
