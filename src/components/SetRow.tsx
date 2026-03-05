import './SetRow.css';
import { Check, Trash2 } from 'lucide-react';

interface SetRowProps {
    index: number;
    type: 'warmup' | 'normal' | 'failure' | 'drop';
    previousStr?: string;
    weight: string;
    reps: string;
    isDone: boolean;
    showRpe?: boolean;
    rpe?: string;
    targetWeight?: number;
    targetReps?: number;
    intensityLabel?: string;
    weightSuggestionUI?: 'autofill' | 'placeholder' | 'badge';
    weightUnit?: string;
    onWeightChange: (val: string) => void;
    onRepsChange: (val: string) => void;
    onRpeChange?: (val: string) => void;
    onToggleDone: () => void;
    onRemove: () => void;
}

export default function SetRow({
    index,
    type,
    previousStr = '-',
    weight,
    reps,
    isDone,
    showRpe = false,
    rpe = '',
    targetWeight,
    targetReps,
    intensityLabel,
    weightSuggestionUI = 'autofill',
    weightUnit = 'lbs',
    onWeightChange,
    onRepsChange,
    onRpeChange,
    onToggleDone,
    onRemove
}: SetRowProps) {

    // A tiny helper to render set type indicator if needed,
    // but usually it's just the index for a normal set.
    const setLabel = type === 'warmup' ? 'W' : type === 'failure' ? 'F' : type === 'drop' ? 'D' : index;

    // Only show target hints for working sets that have AI suggestions
    const hasTarget = type === 'normal' && targetWeight !== undefined && targetReps !== undefined;

    const weightPlaceholder = hasTarget && weightSuggestionUI === 'placeholder'
        ? `${targetWeight} ${weightUnit}`
        : weightUnit;

    const repsPlaceholder = hasTarget && weightSuggestionUI === 'placeholder'
        ? `${targetReps}`
        : 'reps';

    return (
        <div className={`set-row ${isDone ? 'done' : ''}`}>
            <div className="set-col set-index">
                <span className="set-badge">{setLabel}</span>
            </div>
            <div className="set-col set-prev">
                <span className="prev-text">{previousStr}</span>
            </div>
            <div className={`set-col set-input-col${hasTarget && weightSuggestionUI === 'badge' ? ' set-input-col-with-badge' : ''}`}>
                {hasTarget && weightSuggestionUI === 'badge' && (
                    <span className="target-badge">🎯 {targetWeight} {weightUnit} × {targetReps}</span>
                )}
                {intensityLabel && (
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)', borderRadius: '4px', padding: '1px 5px', marginBottom: '2px', display: 'inline-block' }}>
                        {intensityLabel}
                    </span>
                )}
                <input
                    type="number"
                    inputMode="decimal"
                    className="metric-input"
                    placeholder={weightPlaceholder}
                    value={weight}
                    onChange={(e) => onWeightChange(e.target.value)}
                    disabled={isDone}
                />
            </div>
            <div className="set-col set-input-col">
                <input
                    type="number"
                    inputMode="numeric"
                    className="metric-input"
                    placeholder={repsPlaceholder}
                    value={reps}
                    onChange={(e) => onRepsChange(e.target.value)}
                    disabled={isDone}
                />
            </div>
            {showRpe && (
                <div className="set-col set-input-col rpe-col">
                    <input
                        type="number"
                        inputMode="numeric"
                        className="metric-input"
                        placeholder="RPE"
                        value={rpe}
                        onChange={(e) => onRpeChange?.(e.target.value)}
                        disabled={isDone}
                    />
                </div>
            )}
            <div className="set-col set-actions">
                <button
                    className={`action-btn done-btn ${isDone ? 'active' : ''}`}
                    onClick={onToggleDone}
                    aria-label="Toggle done"
                >
                    <Check size={16} />
                </button>
                <button
                    className="action-btn remove-btn"
                    onClick={onRemove}
                    aria-label="Remove set"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
}
