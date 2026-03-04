import { Plus, Dumbbell, Bookmark } from 'lucide-react';
import type { AIWorkoutSuggestion } from '../lib/ai/types';
import './SuggestedAction.css';

interface SuggestedActionProps {
    suggestion: AIWorkoutSuggestion;
    onApply: (suggestion: AIWorkoutSuggestion) => void;
    onSaveTemplate: (suggestion: AIWorkoutSuggestion) => void;
}

export default function SuggestedAction({ suggestion, onApply, onSaveTemplate }: SuggestedActionProps) {
    return (
        <div className="suggested-action-card card">
            <div className="sa-header">
                <Dumbbell size={20} className="sa-icon" />
                <div className="sa-title-wrapper">
                    <span className="sa-label">Suggested Workout</span>
                    <h3 className="sa-title">{suggestion.name}</h3>
                </div>
            </div>

            <div className="sa-exercises">
                {suggestion.exercises.map((ex, idx) => (
                    <div key={idx} className="sa-exercise-row">
                        <div className="sa-ex-name">{ex.name}</div>
                        <div className="sa-ex-details">
                            {ex.sets} × {ex.reps} {ex.weight ? `@ ${ex.weight}` : ''}
                        </div>
                        {ex.notes && <div className="sa-ex-notes">{ex.notes}</div>}
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button className="sa-apply-btn" onClick={() => onApply(suggestion)} style={{ flex: 1 }}>
                    <Plus size={18} />
                    Apply to Logger
                </button>
                <button
                    className="sa-apply-btn"
                    onClick={() => onSaveTemplate(suggestion)}
                    style={{ flex: 1, backgroundColor: 'var(--color-surface)', color: 'var(--color-text-main)', border: '1px solid var(--color-border)' }}
                >
                    <Bookmark size={18} />
                    Save Template
                </button>
            </div>
        </div>
    );
}
