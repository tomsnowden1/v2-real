import { useNavigate } from 'react-router-dom';
import { Settings2, Dumbbell, X } from 'lucide-react';
import type { WeeklyPlan, Template, WorkoutHistory } from '../db/database';
import ScoreRing from './ScoreRing';
import './WeeklyViewCard.css';

interface WeeklyViewCardProps {
    plan: WeeklyPlan;
    templates: Template[];
    histories: WorkoutHistory[];
    onAdjustWeek: () => void;
    onStartToday: (template: Template) => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function WeeklyViewCard({ plan, templates, histories, onAdjustWeek, onStartToday }: WeeklyViewCardProps) {
    const navigate = useNavigate();

    // JS getDay() returns 0 for Sunday, 1 for Monday. We want 0=Mon, 6=Sun
    const todayIndex = (new Date().getDay() + 6) % 7;
    const assignments = plan.dayAssignments || Array(7).fill({ templateId: null });

    const handleDayClick = (_dayIdx: number, isCompleted: boolean, completedWorkoutId?: string, isToday?: boolean, template?: Template) => {
        if (isCompleted && completedWorkoutId) {
            navigate(`/history/${completedWorkoutId}`);
            return;
        }

        if (isToday && template) {
            onStartToday(template);
            return;
        }
    };

    return (
        <div className="weekly-view-card">
            <div className="weekly-view-header">
                <h2>This Week</h2>
                <button
                    className="adjust-week-btn"
                    onClick={onAdjustWeek}
                >
                    <Settings2 size={16} />
                </button>
            </div>

            <div className="weekly-view-days">
                {DAY_LABELS.map((label, idx) => {
                    const assignment = assignments[idx];
                    const isToday = idx === todayIndex;
                    const isPast = idx < todayIndex;
                    const isCompleted = !!assignment?.completedWorkoutId;
                    const hasTemplate = !!assignment?.templateId;
                    const template = hasTemplate ? templates.find(t => t.id === assignment.templateId) : undefined;

                    let indicatorType = 'rest';
                    let subtitle = 'Rest';

                    if (isCompleted) {
                        indicatorType = 'completed';
                        subtitle = template ? template.name : 'Done';
                    } else if (hasTemplate) {
                        if (isPast) {
                            indicatorType = 'missed';
                            subtitle = template ? template.name : 'Missed';
                        } else if (isToday) {
                            indicatorType = 'today';
                            subtitle = template ? template.name : 'Ready';
                        } else {
                            indicatorType = 'scheduled';
                            subtitle = template ? template.name : 'Planned';
                        }
                    } else if (isToday) {
                        // Today, no template scheduled
                        subtitle = 'Rest';
                    }

                    // Find score if completed
                    let score = null;
                    if (isCompleted && assignment.completedWorkoutId) {
                        const history = histories.find(h => h.id === assignment.completedWorkoutId);
                        if (history && history.score) {
                            score = history.score.overall;
                        }
                    }

                    return (
                        <div
                            key={idx}
                            className={`day-column ${isToday ? 'is-today' : ''}`}
                            onClick={() => handleDayClick(idx, isCompleted, assignment.completedWorkoutId, isToday, template)}
                        >
                            <span className="day-label">{label}</span>

                            <div className={`day-indicator type-${indicatorType}`}>
                                {indicatorType === 'completed' && score !== null ? (
                                    <ScoreRing score={score} size={40} strokeWidth={4} label="" />
                                ) : indicatorType === 'completed' ? (
                                    <div style={{ backgroundColor: 'var(--color-primary)', width: '12px', height: '12px', borderRadius: '50%' }} />
                                ) : indicatorType === 'today' ? (
                                    <div className="today-pulse" />
                                ) : indicatorType === 'scheduled' ? (
                                    <Dumbbell size={16} />
                                ) : indicatorType === 'missed' ? (
                                    <X size={16} />
                                ) : null}
                            </div>

                            <span className={`day-subtitle ${isToday && hasTemplate ? 'is-today' : ''}`}>
                                {subtitle}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
