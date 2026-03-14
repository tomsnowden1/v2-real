import { useState } from 'react';
import { Sparkles, RefreshCw, FileText } from 'lucide-react';
import './FinishWorkoutSheet.css';

export type TemplateUpdateMode = 'none' | 'values' | 'values_and_exercises';

interface FinishWorkoutSheetProps {
    isOpen: boolean;
    workoutName: string;
    elapsedStr: string;
    sourceTemplateId: string | null;
    templateName?: string;
    hasApiKey: boolean;
    hasChangesFromTemplate: boolean;
    /** True when exercises were added/removed (not just weights changed). Shows full picker. */
    hasExerciseChanges: boolean;
    isFinishing: boolean;
    onFinish: (templateUpdateMode: TemplateUpdateMode, sendToCoach: boolean) => void;
    onCancel: () => void;
}

export default function FinishWorkoutSheet({
    isOpen,
    workoutName,
    elapsedStr,
    sourceTemplateId,
    templateName,
    hasApiKey,
    hasChangesFromTemplate,
    hasExerciseChanges,
    isFinishing,
    onFinish,
    onCancel
}: FinishWorkoutSheetProps) {
    // Default: save weights (ON) unless exercises changed (then let user choose)
    const [templateUpdateMode, setTemplateUpdateMode] = useState<TemplateUpdateMode>('values');
    const [saveValuesToggle, setSaveValuesToggle] = useState(true);
    const [sendToCoach, setSendToCoach] = useState(hasApiKey);

    if (!isOpen) return null;

    const isFromTemplate = !!sourceTemplateId;

    // Determine effective update mode
    const effectiveMode: TemplateUpdateMode = hasExerciseChanges
        ? templateUpdateMode
        : (saveValuesToggle ? 'values' : 'none');

    return (
        <div className="finish-sheet-overlay" onClick={onCancel}>
            <div className="finish-sheet" onClick={e => e.stopPropagation()}>
                <div className="finish-sheet-handle" />

                <div className="finish-sheet-header">
                    <h2>Finish Workout</h2>
                    <p>{workoutName} · {elapsedStr}</p>
                </div>

                {/* ── Template Update Section ── */}
                {isFromTemplate && hasChangesFromTemplate && (
                    <div className="finish-sheet-section">
                        <div className="finish-sheet-section-label">
                            <FileText size={14} />
                            Update Template{templateName ? ` — ${templateName}` : ''}
                        </div>

                        {hasExerciseChanges ? (
                            /* Full 3-option picker — exercises were added/removed */
                            <div className="template-update-options">
                                <button
                                    className={`template-option ${templateUpdateMode === 'none' ? 'selected' : ''}`}
                                    onClick={() => setTemplateUpdateMode('none')}
                                >
                                    <div className="template-option-radio">
                                        <div className="template-option-radio-inner" />
                                    </div>
                                    <div className="template-option-text">
                                        <h4>Don't update</h4>
                                        <p>Keep the template as-is</p>
                                    </div>
                                </button>

                                <button
                                    className={`template-option ${templateUpdateMode === 'values' ? 'selected' : ''}`}
                                    onClick={() => setTemplateUpdateMode('values')}
                                >
                                    <div className="template-option-radio">
                                        <div className="template-option-radio-inner" />
                                    </div>
                                    <div className="template-option-text">
                                        <h4>Update values only</h4>
                                        <p>Sync today's weights & reps, keep original exercises</p>
                                    </div>
                                </button>

                                <button
                                    className={`template-option ${templateUpdateMode === 'values_and_exercises' ? 'selected' : ''}`}
                                    onClick={() => setTemplateUpdateMode('values_and_exercises')}
                                >
                                    <div className="template-option-radio">
                                        <div className="template-option-radio-inner" />
                                    </div>
                                    <div className="template-option-text">
                                        <h4>Update everything</h4>
                                        <p>Replace the template with today's full workout</p>
                                    </div>
                                </button>
                            </div>
                        ) : (
                            /* Simple toggle — only weights/reps changed */
                            <div className="coach-toggle-row">
                                <div className="coach-toggle-info">
                                    <h4>Save today's weights?</h4>
                                    <p>Update the template with today's weights & reps</p>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={saveValuesToggle}
                                        onChange={e => setSaveValuesToggle(e.target.checked)}
                                    />
                                    <span className="toggle-slider" />
                                </label>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Coach Analysis Toggle ── */}
                <div className="finish-sheet-section">
                    <div className="finish-sheet-section-label">
                        <Sparkles size={14} />
                        AI Analysis
                    </div>

                    <div className="coach-toggle-row">
                        <div className="coach-toggle-info">
                            <h4>
                                <RefreshCw size={14} />
                                Send to Coach
                            </h4>
                            <p>Compare against previous sessions, track PRs & trends</p>
                            {!hasApiKey && (
                                <p className="coach-disabled-hint">
                                    Configure an API key in Settings to enable
                                </p>
                            )}
                        </div>
                        <label className={`toggle-switch ${!hasApiKey ? 'disabled' : ''}`}>
                            <input
                                type="checkbox"
                                checked={sendToCoach && hasApiKey}
                                onChange={e => hasApiKey && setSendToCoach(e.target.checked)}
                                disabled={!hasApiKey}
                            />
                            <span className="toggle-slider" />
                        </label>
                    </div>
                </div>

                {/* ── Actions ── */}
                <div className="finish-sheet-actions">
                    <button
                        className="finish-sheet-btn primary"
                        disabled={isFinishing}
                        onClick={() => onFinish(effectiveMode, sendToCoach && hasApiKey)}
                    >
                        {isFinishing ? 'Saving...' : 'Finish & Save'}
                    </button>
                    <button
                        className="finish-sheet-btn secondary"
                        disabled={isFinishing}
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
