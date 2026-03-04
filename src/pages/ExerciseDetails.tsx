import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Target, AlertTriangle, ChevronRight, Activity, Trophy, ArrowUpCircle, ArrowDownCircle, PlayCircle, Youtube } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './ExerciseDetails.css';

export default function ExerciseDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // Fetch exercise details
    const exercise = useLiveQuery(
        () => db.exercises.get(id as string),
        [id]
    );

    // Fetch historical data to build the progression chart
    // For this MVP, we will chart the "Max Weight" lifted for this exercise per session
    const history = useLiveQuery(
        () => db.workoutHistory.orderBy('startTime').toArray(),
        []
    );

    // Fetch exact PR strings (e.g. 1RM)
    const prs = useLiveQuery(
        () => db.prs.where('exerciseId').equals(id as string).toArray(),
        [id]
    );

    const [chartData, setChartData] = useState<any[]>([]);

    useEffect(() => {
        if (!history || !id) return;

        const dataPoints: any[] = [];

        history.forEach(workout => {
            const exSession = workout.exercises.find(we => we.exerciseId === id);
            if (exSession && exSession.sets.length > 0) {
                // Find max weight in this session
                let maxWeight = 0;
                exSession.sets.forEach(set => {
                    if (set.isDone && set.weight > maxWeight) {
                        maxWeight = set.weight;
                    }
                });

                if (maxWeight > 0) {
                    const date = new Date(workout.startTime);
                    dataPoints.push({
                        date: `${date.getMonth() + 1}/${date.getDate()}`,
                        timestamp: workout.startTime,
                        weight: maxWeight
                    });
                }
            }
        });

        // Ensure chronological order
        dataPoints.sort((a, b) => a.timestamp - b.timestamp);
        setChartData(dataPoints);

    }, [history, id]);


    if (exercise === undefined) {
        return <div className="page-content" style={{ padding: 20 }}>Loading...</div>;
    }

    if (exercise === null) {
        return (
            <div className="page-content" style={{ padding: 20, textAlign: 'center' }}>
                <h2>Exercise not found</h2>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 20 }}>This exercise might be a temporary custom entry that hasn't been saved to your library yet.</p>
                <button
                    onClick={() => navigate(-1)}
                    style={{ backgroundColor: 'var(--color-primary)', color: 'white', padding: '10px 20px', borderRadius: '8px' }}
                >
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="exercise-details-page">
            <header className="details-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={24} />
                </button>
                <h1 className="details-title">{exercise.name}</h1>
                <div style={{ width: 24 }}></div> {/* Spacer for centering */}
            </header>

            <div className="details-content">
                {/* Progression Chart */}
                <div className="details-card chart-card">
                    <div className="card-header-flex">
                        <Activity size={20} className="icon-main" />
                        <h2>Progression (Max Weight)</h2>
                    </div>
                    <div className="chart-container">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                                        axisLine={false}
                                        tickLine={false}
                                        dy={10}
                                    />
                                    <YAxis
                                        tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                                        labelStyle={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}
                                        itemStyle={{ color: 'var(--color-primary)', fontWeight: 600 }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="weight"
                                        stroke="var(--color-primary)"
                                        strokeWidth={3}
                                        dot={{ fill: 'var(--color-primary)', r: 4, strokeWidth: 0 }}
                                        activeDot={{ r: 6 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="empty-chart">Log this exercise to see your progression!</div>
                        )}
                    </div>
                </div>

                {/* Instructions */}
                {(exercise.instructions || exercise.gotchas) && (
                    <div className="details-card">
                        <div className="card-header-flex">
                            <Target size={20} className="icon-main" />
                            <h2>Instructions</h2>
                        </div>
                        {exercise.instructions && (
                            <p className="instruction-text">{exercise.instructions}</p>
                        )}

                        {exercise.gotchas && exercise.gotchas.length > 0 && (
                            <div className="gotchas-container">
                                {exercise.gotchas.map((g, i) => (
                                    <div key={i} className="gotcha-row">
                                        <AlertTriangle size={16} className="icon-warning" />
                                        <span>{g}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Personal Records */}
                {prs && prs.length > 0 && (
                    <div className="details-card pr-card">
                        <div className="card-header-flex">
                            <Trophy size={20} className="icon-main" style={{ color: '#eab308' }} />
                            <h2>Personal Records</h2>
                        </div>
                        <div className="pr-list">
                            {prs.map(pr => (
                                <div key={pr.id} className="pr-row">
                                    <span className="pr-metric">{pr.metric}</span>
                                    <span className="pr-value">{pr.value} {pr.metric.includes('Weight') || pr.metric === '1RM' ? 'kg' : ''}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Muscle Groups */}
                {(exercise.primaryMuscle || (exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0)) && (
                    <div className="details-card muscles-card">
                        <h3>Muscle Groups</h3>
                        <div className="muscle-tags">
                            {exercise.primaryMuscle && (
                                <span className="muscle-tag primary">{exercise.primaryMuscle} (Primary)</span>
                            )}
                            {exercise.secondaryMuscles?.map((m, i) => (
                                <span key={i} className="muscle-tag secondary">{m}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Variations & Media */}
                <div className="details-card media-card">
                    <div className="card-header-flex">
                        <Youtube size={20} className="icon-youtube" />
                        <h2>Video Tutorial</h2>
                    </div>
                    <div className="video-placeholder">
                        <PlayCircle size={40} className="play-icon" />
                        <span>Watch Demo</span>
                    </div>
                </div>

                {(exercise.progressions || exercise.regressions) && (
                    <div className="details-card variations-card">
                        <h3>Variations</h3>
                        <div className="variations-list">
                            {exercise.progressions?.map((prog, i) => (
                                <div key={`p-${i}`} className="card-row">
                                    <div className="variation-label">
                                        <ArrowUpCircle size={18} className="icon-prog" />
                                        <span>{prog}</span>
                                    </div>
                                    <ChevronRight size={18} color="var(--color-text-muted)" />
                                </div>
                            ))}
                            {exercise.regressions?.map((reg, i) => (
                                <div key={`r-${i}`} className="card-row">
                                    <div className="variation-label">
                                        <ArrowDownCircle size={18} className="icon-reg" />
                                        <span>{reg}</span>
                                    </div>
                                    <ChevronRight size={18} color="var(--color-text-muted)" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
