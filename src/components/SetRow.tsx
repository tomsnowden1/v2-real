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
    onWeightChange,
    onRepsChange,
    onRpeChange,
    onToggleDone,
    onRemove
}: SetRowProps) {

    // A tiny helper to render set type indicator if needed, 
    // but usually it's just the index for a normal set.
    const setLabel = type === 'warmup' ? 'W' : type === 'failure' ? 'F' : type === 'drop' ? 'D' : index;

    return (
        <div className={`set-row ${isDone ? 'done' : ''}`}>
            <div className="set-col set-index">
                <span className="set-badge">{setLabel}</span>
            </div>
            <div className="set-col set-prev">
                <span className="prev-text">{previousStr}</span>
            </div>
            <div className="set-col set-input-col">
                <input
                    type="number"
                    inputMode="decimal"
                    className="metric-input"
                    placeholder="kg"
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
                    placeholder="reps"
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
