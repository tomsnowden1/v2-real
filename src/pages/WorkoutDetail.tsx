import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { ArrowLeft, Clock, Dumbbell, Calendar, Trash2 } from 'lucide-react';
import ScoreRing from '../components/ScoreRing';
import './WorkoutDetail.css';

export default function WorkoutDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const workout = useLiveQuery(
        () => db.workoutHistory.get(id as string),
        [id]
    );

    // ── helpers ──────────────────────────────────────────────────────
    const formatDate = (timestamp?: number) => {
        if (!timestamp) return 'Unknown Date';
        return new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        }).format(new Date(timestamp));
    };

    const formatDuration = (ms?: number) => {
        if (!ms) return '0m';
        const totalMins = Math.floor(ms / 60000);
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        if (hrs > 0) return `${hrs}h ${mins}m`;
        return `${mins}m`;
    };

    const calculateTotalVolume = (exercises: any[]) => {
        let volume = 0;
        if (!exercises) return 0;
        exercises.forEach(ex => {
            if (!ex.sets) return;
            ex.sets.forEach((set: any) => {
                if (set.isDone) {
                    volume += (set.weight || 0) * (set.reps || 0);
                }
            });
        });
        return volume;
    };

    const exerciseVolume = (sets: any[]) => {
        return sets.reduce((acc: number, s: any) => {
            if (s.isDone) return acc + (s.weight || 0) * (s.reps || 0);
            return acc;
        }, 0);
    };

    const setTypeLabel = (type: string) => {
        switch (type) {
            case 'warmup': return 'Warmup';
            case 'drop': return 'Drop';
            case 'failure': return 'Failure';
            default: return 'Working';
        }
    };

    // ── delete handler ──────────────────────────────────────────────
    const handleDelete = async () => {
        if (!id) return;
        await db.workoutHistory.delete(id);
        navigate('/history', { replace: true });
    };

    // ── loading / not-found ─────────────────────────────────────────
    if (workout === undefined) {
        return <div className="page-content wd-page" style={{ padding: 20 }}>Loading…</div>;
    }
    if (!workout) {
        return (
            <div className="page-content wd-page" style={{ padding: 20, textAlign: 'center' }}>
                <h2>Workout not found</h2>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 20 }}>
                    This workout may have been deleted.
                </p>
                <button
                    onClick={() => navigate('/history')}
                    className="wd-back-link"
                >
                    Back to History
                </button>
            </div>
        );
    }

    const totalVolume = calculateTotalVolume(workout.exercises);

    return (
        <div className="wd-page">
            {/* ── Header ─────────────────────────────────────────────── */}
            <header className="wd-header">
                <button className="back-btn" onClick={() => navigate('/history')}>
                    <ArrowLeft size={24} />
                </button>
                <h1 className="wd-title">{workout.name}</h1>
                <div style={{ width: 24 }} /> {/* spacer */}
            </header>

            <div className="wd-content">
                {/* ── Date & Stats Banner ────────────────────────────── */}
                <div className="wd-banner card">
                    <div className="wd-banner-date">
                        <Calendar size={16} />
                        <span>{formatDate(workout.startTime)}</span>
                    </div>
                    <div className="wd-banner-stats">
                        <div className="wd-stat">
                            <Clock size={18} />
                            <div>
                                <span className="wd-stat-value">{formatDuration(workout.durationMs)}</span>
                                <span className="wd-stat-label">Duration</span>
                            </div>
                        </div>
                        <div className="wd-stat">
                            <Dumbbell size={18} />
                            <div>
                                <span className="wd-stat-value">{totalVolume.toLocaleString()} kg</span>
                                <span className="wd-stat-label">Total Volume</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Score Breakdown ────────────────────────────────── */}
                {workout.score && (
                    <div className="wd-score-card card">
                        <h2 className="wd-section-title">Workout Score</h2>
                        <div className="wd-score-layout">
                            <ScoreRing score={workout.score.overall} size={90} strokeWidth={10} label="Overall" />
                            <div className="wd-sub-scores">
                                <ScoreBar label="Consistency" value={workout.score.consistency} />
                                <ScoreBar label="Progression" value={workout.score.progression} />
                                <ScoreBar label="Quality" value={workout.score.quality} />
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Exercises ──────────────────────────────────────── */}
                <h2 className="wd-section-title" style={{ padding: '0 4px' }}>
                    Exercises ({workout.exercises?.length || 0})
                </h2>

                {workout.exercises?.map((ex, idx) => (
                    <div key={ex.id || idx} className="wd-exercise-card card">
                        <div className="wd-ex-header">
                            <span className="wd-ex-index">{idx + 1}</span>
                            <h3 className="wd-ex-name">{ex.exerciseName || ex.exerciseId}</h3>
                            <span className="wd-ex-vol">{exerciseVolume(ex.sets).toLocaleString()} kg</span>
                        </div>

                        <div className="wd-sets-table">
                            <div className="wd-sets-row wd-sets-header-row">
                                <span className="wd-set-col-num">Set</span>
                                <span className="wd-set-col-type">Type</span>
                                <span className="wd-set-col-weight">Weight</span>
                                <span className="wd-set-col-reps">Reps</span>
                            </div>
                            {ex.sets.map((set, si) => (
                                <div
                                    key={set.id || si}
                                    className={`wd-sets-row ${!set.isDone ? 'wd-set-skipped' : ''}`}
                                >
                                    <span className="wd-set-col-num">{si + 1}</span>
                                    <span className={`wd-set-col-type wd-badge wd-badge-${set.type}`}>
                                        {setTypeLabel(set.type)}
                                    </span>
                                    <span className="wd-set-col-weight">{set.weight} kg</span>
                                    <span className="wd-set-col-reps">× {set.reps}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {/* ── Delete Button ──────────────────────────────────── */}
                <button className="wd-delete-btn" onClick={() => setShowDeleteModal(true)}>
                    <Trash2 size={18} />
                    Delete Workout
                </button>
            </div>

            {/* ── Delete Modal ───────────────────────────────────────── */}
            {showDeleteModal && (
                <div className="wd-modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="wd-modal" onClick={e => e.stopPropagation()}>
                        <h3>Delete Workout?</h3>
                        <p>This will permanently remove this workout from your history. This action cannot be undone.</p>
                        <div className="wd-modal-actions">
                            <button className="wd-modal-cancel" onClick={() => setShowDeleteModal(false)}>
                                Cancel
                            </button>
                            <button className="wd-modal-delete" onClick={handleDelete}>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Sub-score bar component (inline) ────────────────────────────── */
function ScoreBar({ label, value }: { label: string; value: number }) {
    let barColor = 'var(--color-primary)';
    if (value < 60) barColor = '#ef4444';
    else if (value < 85) barColor = '#f59e0b';

    return (
        <div className="wd-score-bar">
            <div className="wd-score-bar-header">
                <span className="wd-score-bar-label">{label}</span>
                <span className="wd-score-bar-value" style={{ color: barColor }}>{value}</span>
            </div>
            <div className="wd-score-bar-track">
                <div
                    className="wd-score-bar-fill"
                    style={{ width: `${value}%`, backgroundColor: barColor }}
                />
            </div>
        </div>
    );
}
