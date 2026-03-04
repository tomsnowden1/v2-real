import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, BarChart, Bar
} from 'recharts';
import { Activity, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';
import './ProgressTrends.css';

export default function ProgressTrends() {
    const history = useLiveQuery(
        () => db.workoutHistory.orderBy('startTime').toArray(),
        []
    );

    if (!history) {
        return <div className="trends-loading">Loading trends data...</div>;
    }

    if (history.length === 0) {
        return (
            <div className="trends-empty">
                <TrendingUp size={48} className="empty-icon" />
                <p>Complete workouts to unlock your progress trends!</p>
            </div>
        );
    }

    // 1. Process data for Volume Chart (Area)
    const volumeData = history.map(w => {
        let totalVolume = 0;
        w.exercises.forEach(ex => {
            if (!ex.sets) return;
            ex.sets.forEach(set => {
                if (set.isDone) {
                    totalVolume += (set.weight || 0) * (set.reps || 0);
                }
            });
        });
        const date = new Date(w.startTime);
        return {
            date: `${date.getMonth() + 1}/${date.getDate()}`,
            timestamp: w.startTime,
            volume: totalVolume,
            name: w.name
        };
    }).sort((a, b) => a.timestamp - b.timestamp);

    // 2. Process data for Score Chart (Line)
    const scoreData = history
        .filter(w => w.score && w.score.overall > 0)
        .map(w => {
            const date = new Date(w.startTime);
            return {
                date: `${date.getMonth() + 1}/${date.getDate()}`,
                timestamp: w.startTime,
                score: w.score!.overall,
                progression: w.score!.progression,
                consistency: w.score!.consistency,
                name: w.name
            };
        }).sort((a, b) => a.timestamp - b.timestamp);

    // 3. Process data for Frequency Chart (Bar) - Workouts per Week
    // Group by ISO week
    const frequencyMap = new Map<string, number>();
    history.forEach(w => {
        const d = new Date(w.startTime);
        // Simplistic grouping by Monday of that week
        const day = d.getDay() || 7;
        d.setHours(-24 * (day - 1));
        const weekStr = `Week ${d.getMonth() + 1}/${d.getDate()}`;

        frequencyMap.set(weekStr, (frequencyMap.get(weekStr) || 0) + 1);
    });

    const frequencyData = Array.from(frequencyMap.entries()).map(([week, count]) => ({
        week,
        count
    }));

    return (
        <div className="progress-trends-container">

            {/* Total Volume */}
            <div className="trend-card">
                <div className="trend-header">
                    <Activity size={20} className="icon-main" />
                    <h2>Volume Output (kg)</h2>
                </div>
                <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={volumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                            <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                                labelStyle={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}
                                itemStyle={{ color: 'var(--color-primary)', fontWeight: 600 }}
                            />
                            <Area type="monotone" dataKey="volume" stroke="var(--color-primary)" fillOpacity={1} fill="url(#colorVolume)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* AI Scores */}
            {scoreData.length > 0 && (
                <div className="trend-card">
                    <div className="trend-header">
                        <TrendingUp size={20} className="icon-main" />
                        <h2>IronAI Session Scores</h2>
                    </div>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={scoreData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                                <XAxis dataKey="date" tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis domain={[0, 100]} tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                                    labelStyle={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}
                                />
                                <Line type="monotone" dataKey="score" stroke="var(--color-primary)" strokeWidth={3} dot={{ fill: 'var(--color-primary)', r: 4, strokeWidth: 0 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Frequency */}
            <div className="trend-card">
                <div className="trend-header">
                    <CalendarIcon size={20} className="icon-main" />
                    <h2>Workouts Per Week</h2>
                </div>
                <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={frequencyData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                            <XAxis dataKey="week" tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                            <YAxis allowDecimals={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip
                                cursor={{ fill: 'var(--color-surface)' }}
                                contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                                itemStyle={{ color: 'var(--color-primary)', fontWeight: 600 }}
                            />
                            <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    );
}
