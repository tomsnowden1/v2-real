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
    onFinish,
    onCancel
}: FinishWorkoutSheetProps) {
    const [templateUpdateMode, setTemplateUpdateMode] = useState<TemplateUpdateMode>('none');
    const [sendToCoach, setSendToCoach] = useState(hasApiKey);

    if (!isOpen) return null;

    const isFromTemplate = !!sourceTemplateId;

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
                                    <h4>Update values</h4>
                                    <p>Sync today's weights & reps back to the template</p>
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
                                    <h4>Update values & exercises</h4>
                                    <p>Replace the template entirely with today's workout</p>
                                </div>
                            </button>
                        </div>
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
                        onClick={() => onFinish(templateUpdateMode, sendToCoach && hasApiKey)}
                    >
                        Finish & Save
                    </button>
                    <button
                        className="finish-sheet-btn secondary"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
