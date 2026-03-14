import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Dumbbell, Clock, ArrowRight, Sparkles } from 'lucide-react';
import './WorkoutCompleteModal.css';

interface WorkoutCompleteModalProps {
    isOpen: boolean;
    workoutName: string;
    durationStr: string;
    totalVolume: number;
    weightUnit: string;
    goToCoach: boolean;
    nextTemplateName?: string;
    nextTemplateDay?: string;
    onDone: () => void;
}

export default function WorkoutCompleteModal({
    isOpen,
    workoutName,
    durationStr,
    totalVolume,
    weightUnit,
    goToCoach,
    nextTemplateName,
    nextTemplateDay,
    onDone,
}: WorkoutCompleteModalProps) {
    const navigate = useNavigate();

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onDone();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onDone]);

    if (!isOpen) return null;

    const handleAction = () => {
        onDone();
        navigate(goToCoach ? '/coach' : '/');
    };

    return (
        <div className="wc-overlay" role="dialog" aria-modal="true" aria-label="Workout complete">
            <div className="wc-sheet">
                <div className="wc-trophy">
                    <Trophy size={40} className="wc-trophy-icon" />
                </div>

                <h2 className="wc-title">Workout Complete!</h2>
                <p className="wc-name">{workoutName}</p>

                <div className="wc-stats">
                    <div className="wc-stat">
                        <Clock size={16} className="wc-stat-icon" />
                        <span className="wc-stat-label">Time</span>
                        <span className="wc-stat-value">{durationStr}</span>
                    </div>
                    <div className="wc-stat-divider" />
                    <div className="wc-stat">
                        <Dumbbell size={16} className="wc-stat-icon" />
                        <span className="wc-stat-label">Volume</span>
                        <span className="wc-stat-value">
                            {totalVolume > 0 ? `${totalVolume.toLocaleString()} ${weightUnit}` : '—'}
                        </span>
                    </div>
                </div>

                <div className="wc-next">
                    {goToCoach ? (
                        <button className="wc-next-btn coach" onClick={handleAction}>
                            <Sparkles size={16} />
                            Coach is reviewing this
                            <ArrowRight size={16} />
                        </button>
                    ) : nextTemplateName ? (
                        <button className="wc-next-btn home" onClick={handleAction}>
                            <span>
                                Next up: <strong>{nextTemplateName}</strong>
                                {nextTemplateDay ? ` on ${nextTemplateDay}` : ''}
                            </span>
                            <ArrowRight size={16} />
                        </button>
                    ) : (
                        <button className="wc-next-btn home" onClick={handleAction}>
                            Back to Home
                            <ArrowRight size={16} />
                        </button>
                    )}
                </div>

                <button className="wc-done-btn" onClick={onDone}>
                    Done
                </button>
            </div>
        </div>
    );
}
