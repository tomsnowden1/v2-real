import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { getUserProfile } from '../db/userProfileService';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { ChevronLeft, Dumbbell, Clock, TrendingUp, Calendar } from 'lucide-react';
import './Analytics.css';

function formatDuration(ms: number): string {
    const m = Math.round(ms / 60000);
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function getWeekKey(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay() + 1); // Monday
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function Analytics() {
    const navigate = useNavigate();
    const history = useLiveQuery(() => db.workoutHistory.orderBy('startTime').toArray(), []);
    const profile = useLiveQuery(() => getUserProfile().then(p => p || null));

    const weightUnit = profile?.weightUnit ?? 'lbs';

    const stats = useMemo(() => {
        if (!history || history.length === 0) return null;

        let totalVolume = 0;
        let totalDuration = 0;
        const muscleCount: Record<string, number> = {};

        for (const w of history) {
            totalDuration += w.durationMs || 0;
            for (const ex of w.exercises) {
                for (const set of ex.sets) {
                    if (set.isDone) totalVolume += (set.weight || 0) * (set.reps || 0);
                }
            }
        }

        return {
            totalWorkouts: history.length,
            totalVolume: Math.round(totalVolume),
            avgDurationMs: totalDuration / history.length,
            muscleCount,
        };
    }, [history]);

    // Weekly volume chart — last 12 weeks
    const weeklyVolume = useMemo(() => {
        if (!history) return [];
        const weeks: Record<string, { week: string; volume: number; count: number }> = {};

        for (const w of history) {
            const key = getWeekKey(new Date(w.startTime));
            if (!weeks[key]) weeks[key] = { week: key, volume: 0, count: 0 };
            weeks[key].count++;
            for (const ex of w.exercises) {
                for (const set of ex.sets) {
                    if (set.isDone) weeks[key].volume += (set.weight || 0) * (set.reps || 0);
                }
            }
        }

        return Object.values(weeks)
            .sort((a, b) => {
                const [am, ad] = a.week.split('/').map(Number);
                const [bm, bd] = b.week.split('/').map(Number);
                return am !== bm ? am - bm : ad - bd;
            })
            .slice(-12)
            .map(w => ({ ...w, volume: Math.round(w.volume) }));
    }, [history]);

    // Muscle group breakdown
    const muscleBreakdown = useMemo(() => {
        if (!history) return [];
        const counts: Record<string, number> = {};
        for (const w of history) {
            for (const ex of w.exercises) {
                // exerciseId lookup for bodyPart isn't feasible without joining — use exerciseName heuristic
                // Instead count completed sets per exercise name
                const done = ex.sets.filter(s => s.isDone).length;
                if (done > 0) {
                    const name = ex.exerciseName || ex.exerciseId;
                    counts[name] = (counts[name] || 0) + done;
                }
            }
        }
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, sets]) => ({ name, sets }));
    }, [history]);

    if (!history) {
        return (
            <div className="page-content analytics-page">
                <div className="analytics-header">
                    <button className="analytics-back" onClick={() => navigate(-1)} aria-label="Go back">
                        <ChevronLeft size={20} />
                    </button>
                    <h1>Analytics</h1>
                </div>
                <p className="analytics-loading">Loading…</p>
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="page-content analytics-page">
                <div className="analytics-header">
                    <button className="analytics-back" onClick={() => navigate(-1)} aria-label="Go back">
                        <ChevronLeft size={20} />
                    </button>
                    <h1>Analytics</h1>
                </div>
                <div className="analytics-empty">
                    <TrendingUp size={48} />
                    <p>Complete some workouts to see your analytics!</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-content analytics-page">
            <div className="analytics-header">
                <button className="analytics-back" onClick={() => navigate(-1)} aria-label="Go back">
                    <ChevronLeft size={20} />
                </button>
                <h1>Analytics</h1>
            </div>

            {/* ── Quick stats ── */}
            {stats && (
                <div className="analytics-stats">
                    <div className="analytics-stat">
                        <Calendar size={18} className="analytics-stat-icon" />
                        <span className="analytics-stat-value">{stats.totalWorkouts}</span>
                        <span className="analytics-stat-label">Workouts</span>
                    </div>
                    <div className="analytics-stat">
                        <Dumbbell size={18} className="analytics-stat-icon" />
                        <span className="analytics-stat-value">{stats.totalVolume.toLocaleString()}</span>
                        <span className="analytics-stat-label">Total {weightUnit}</span>
                    </div>
                    <div className="analytics-stat">
                        <Clock size={18} className="analytics-stat-icon" />
                        <span className="analytics-stat-value">{formatDuration(stats.avgDurationMs)}</span>
                        <span className="analytics-stat-label">Avg Duration</span>
                    </div>
                </div>
            )}

            {/* ── Weekly volume chart ── */}
            {weeklyVolume.length > 1 && (
                <section className="analytics-section">
                    <h2 className="analytics-section-title">
                        <TrendingUp size={15} />
                        Weekly Volume ({weightUnit})
                    </h2>
                    <div className="analytics-chart">
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={weeklyVolume} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                                <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px' }}
                                    formatter={(v: number | undefined) => [`${(v ?? 0).toLocaleString()} ${weightUnit}`, 'Volume'] as [string, string]}
                                />
                                <Bar dataKey="volume" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </section>
            )}

            {/* ── Workouts per week ── */}
            {weeklyVolume.length > 1 && (
                <section className="analytics-section">
                    <h2 className="analytics-section-title">
                        <Calendar size={15} />
                        Workouts per Week
                    </h2>
                    <div className="analytics-chart">
                        <ResponsiveContainer width="100%" height={140}>
                            <BarChart data={weeklyVolume} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                                <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px' }}
                                    formatter={(v: number | undefined) => [v ?? 0, 'Workouts'] as [number, string]}
                                />
                                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </section>
            )}

            {/* ── Most-trained exercises ── */}
            {muscleBreakdown.length > 0 && (
                <section className="analytics-section">
                    <h2 className="analytics-section-title">
                        <Dumbbell size={15} />
                        Most-Trained Exercises
                    </h2>
                    <div className="analytics-exercise-list">
                        {muscleBreakdown.map(({ name, sets }, i) => {
                            const max = muscleBreakdown[0].sets;
                            const pct = Math.round((sets / max) * 100);
                            return (
                                <div key={i} className="analytics-exercise-row">
                                    <span className="analytics-exercise-name">{name}</span>
                                    <div className="analytics-exercise-bar-wrap">
                                        <div className="analytics-exercise-bar" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="analytics-exercise-sets">{sets} sets</span>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
}
