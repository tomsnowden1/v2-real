import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { Clock, Dumbbell, Calendar, LayoutList, TrendingUp } from 'lucide-react';
import ScoreRing from '../components/ScoreRing';
import ProgressTrends from '../components/ProgressTrends';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import './History.css';

export default function History() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'log' | 'trends'>('log');

    const history = useLiveQuery(async () => {
        const result = await db.workoutHistory.toArray();
        result.sort((a, b) => b.startTime - a.startTime);
        return result;
    });

    const formatTime = (ms?: number) => {
        if (!ms) return '0m';
        const totalMins = Math.floor(ms / 60000);
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        if (hrs > 0) return `${hrs}h ${mins}m`;
        return `${mins}m`;
    };

    const formatDate = (timestamp?: number) => {
        if (!timestamp) return 'Unknown Date';
        return new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        }).format(new Date(timestamp));
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

    if (history === undefined) {
        return <Spinner label="Loading history..." />;
    }

    return (
        <div className="page-content history-page">
            <header className="history-header">
                <h1>History</h1>
            </header>

            <div className="history-segmented-control">
                <button
                    className={`segment-btn ${activeTab === 'log' ? 'active' : ''}`}
                    onClick={() => setActiveTab('log')}
                >
                    <LayoutList size={18} />
                    <span>Session Log</span>
                </button>
                <button
                    className={`segment-btn ${activeTab === 'trends' ? 'active' : ''}`}
                    onClick={() => setActiveTab('trends')}
                >
                    <TrendingUp size={18} />
                    <span>Trends</span>
                </button>
            </div>

            {activeTab === 'log' ? (
                <div className="history-list">
                    {history && history.filter(w => w != null).map(workout => (
                        <div key={workout.id} className="history-card card" onClick={() => navigate(`/history/${workout.id}`)} role="button" tabIndex={0}>
                            <div className="hc-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h3 className="hc-title">{workout.name}</h3>
                                    <div style={{ height: '4px' }} />
                                    <span className="hc-date">{formatDate(workout.startTime)}</span>
                                </div>
                                {workout.score && (
                                    <ScoreRing score={workout.score.overall} size={48} strokeWidth={6} label="" />
                                )}
                            </div>

                            <div className="hc-metrics" style={{ marginTop: '16px' }}>
                                <div className="hc-metric">
                                    <Clock size={16} />
                                    <span>{formatTime(workout.durationMs)}</span>
                                </div>
                                <div className="hc-metric">
                                    <Dumbbell size={16} />
                                    <span>{calculateTotalVolume(workout.exercises)} kg Volume</span>
                                </div>
                            </div>

                            <div className="hc-exercises">
                                {workout.exercises && workout.exercises.slice(0, 3).map((ex: any, i: number) => {
                                    const bestSet = (ex.sets || []).reduce((prev: any, curr: any) => {
                                        const currTotal = (curr.weight || 0) * (curr.reps || 0);
                                        const prevTotal = (prev.weight || 0) * (prev.reps || 0);
                                        return currTotal > prevTotal ? curr : prev;
                                    }, { weight: 0, reps: 0 });

                                    return (
                                        <div key={i} className="hc-exercise-row">
                                            <span className="hc-ex-sets">{(ex.sets || []).length} ×</span>
                                            <span className="hc-ex-name">{ex.exerciseName || ex.exerciseId}</span>
                                            <span className="hc-ex-best">
                                                Best: {bestSet.weight || 0}kg × {bestSet.reps || 0}
                                            </span>
                                        </div>
                                    )
                                })}
                                {workout.exercises && workout.exercises.length > 3 && (
                                    <div className="hc-exercise-overflow">
                                        + {workout.exercises.length - 3} more exercises
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {history.length === 0 && (
                        <EmptyState
                            icon={<Calendar size={48} />}
                            title="No workouts yet"
                            description="Finish a workout to see it here."
                        />
                    )}
                </div>
            ) : (
                <div className="history-trends">
                    <ProgressTrends />
                </div>
            )}
        </div>
    );
}
