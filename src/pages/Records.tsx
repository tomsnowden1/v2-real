import { useLiveQuery } from 'dexie-react-hooks';
import { getPRsGroupedByExercise } from '../db/prService';
import { db } from '../db/database';
import { getUserProfile } from '../db/userProfileService';
import { Trophy, Calendar } from 'lucide-react';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import './Records.css';

export default function Records() {
    const groupedPRs = useLiveQuery(() => getPRsGroupedByExercise());
    const exercises = useLiveQuery(() => db.exercises.toArray());
    const profile = useLiveQuery(() => getUserProfile());

    if (!groupedPRs || !exercises) {
        return <Spinner label="Loading records..." />;
    }

    const exerciseMap = new Map(exercises.map(ex => [ex.id, ex.name]));
    const weightUnit = profile?.weightUnit || 'lbs';

    const formatValue = (metric: string, value: number) => {
        if (metric === 'Max Reps') return `${value} reps`;
        return `${value} ${weightUnit}`;
    };

    return (
        <div className="page-content records-page">
            <h1 className="records-title">
                <Trophy size={28} className="records-trophy-header" />
                Personal Records
            </h1>
            <p className="records-subtitle">
                Your all-time best performances across all exercises.
            </p>

            {Object.keys(groupedPRs).length === 0 ? (
                <EmptyState
                    icon={<Trophy size={48} />}
                    title="No records yet"
                    description="Log some workouts to start tracking your best lifts."
                />
            ) : (
                <div className="records-list">
                    {Object.entries(groupedPRs).map(([exerciseId, prs]) => {
                        const exerciseName = exerciseMap.get(exerciseId) || 'Unknown Exercise';
                        return (
                            <div key={exerciseId} className="card pr-group-card">
                                <h2 className="pr-exercise-title">{exerciseName}</h2>
                                <div className="pr-grid">
                                    {prs.map(pr => (
                                        <div key={pr.id} className="pr-metric-card">
                                            <div className="pr-metric-header">
                                                <Trophy size={16} className="pr-trophy-icon" />
                                                <span className="pr-metric-name">{pr.metric}</span>
                                            </div>
                                            <div className="pr-metric-value">
                                                {formatValue(pr.metric, pr.value)}
                                            </div>
                                            <div className="pr-metric-date">
                                                <Calendar size={12} />
                                                <span>{new Date(pr.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
