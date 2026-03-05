import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getCurrentWeeklyPlan, getCurrentWeekId, calculateWeeklyScore, applyShiftLogic } from '../db/weeklyPlanService';
import { db } from '../db/database';
import { useWorkout } from '../context/WorkoutContext';
import { generateId } from '../lib/id';
import { Play, Bookmark, Dumbbell, Sparkles } from 'lucide-react';
import AdjustWeekModal from '../components/AdjustWeekModal';
import WeeklyCheckInModal from '../components/WeeklyCheckInModal';
import WeeklyViewCard from '../components/WeeklyViewCard';
import { getUserProfile } from '../db/userProfileService';
import ScoreRing from '../components/ScoreRing';
import './Home.css';

export default function Home() {
    const navigate = useNavigate();
    const { startWorkout, updateExercises, isActive } = useWorkout();
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
    const [templateToStart, setTemplateToStart] = useState<import('../db/database').Template | null>(null);

    // LiveQuery must only perform READ operations.
    const plan = useLiveQuery(() => db.weeklyPlans.get(getCurrentWeekId()));
    const templates = useLiveQuery(() => db.templates.toArray());
    const recentHistories = useLiveQuery(() => db.workoutHistory.orderBy('startTime').reverse().limit(1).toArray());
    const lastWorkout = recentHistories ? recentHistories[0] : null;

    // We need more histories for the weekly view card
    const thisWeekHistories = useLiveQuery(() => {
        if (!plan?.weekStartDate) return [];
        return db.workoutHistory
            .where('startTime').aboveOrEqual(plan.weekStartDate)
            .toArray();
    });

    const profile = useLiveQuery(() => getUserProfile().then(p => p || null));

    const hasPromptedCheckIn = useRef(false);

    // Perform the mutation (if plan doesn't exist) outside the LiveQuery scope.
    useEffect(() => {
        getCurrentWeeklyPlan().catch(console.error);
    }, []);

    // Calculate weekly score + apply shift logic once per browser session.
    // sessionStorage guard prevents repeated runs on every re-render.
    useEffect(() => {
        const weekId = getCurrentWeekId();
        const sessionKey = `architect-score-${weekId}`;
        if (!sessionStorage.getItem(sessionKey)) {
            sessionStorage.setItem(sessionKey, '1');
            calculateWeeklyScore(weekId).catch(console.error);
            applyShiftLogic(weekId).catch(console.error);
        }
    }, []);

    useEffect(() => {
        if (plan && profile && plan.hasCheckedIn === false && !hasPromptedCheckIn.current) {
            // Don't auto-open for new users in their first week
            const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
            const accountAge = profile.createdAt ? Date.now() - profile.createdAt : Infinity;
            if (accountAge < SEVEN_DAYS_MS) return;

            hasPromptedCheckIn.current = true;
            setIsCheckInModalOpen(true);
        }
    }, [plan?.hasCheckedIn, profile]);

    if (!plan) {
        return <div className="page-content home-page"><p style={{ padding: 20 }}>Loading your week...</p></div>;
    }

    const { dayAssignments = [] } = plan;

    // Find today's template
    const todayIndex = (new Date().getDay() + 6) % 7;
    const todaysAssignment = dayAssignments[todayIndex];
    let nextTemplateToDo = null;
    if (todaysAssignment && todaysAssignment.templateId && !todaysAssignment.completedWorkoutId && templates) {
        const found = templates.find(t => t.id === todaysAssignment.templateId);
        if (found) {
            nextTemplateToDo = {
                name: found.name,
                templateId: found.id,
                originalTemplate: found
            };
        }
    }

    return (
        <div className="page-content home-page">
            <header className="home-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>This Week</h1>
            </header>

            <div className="home-content">
                {lastWorkout && lastWorkout.score && (
                    <section className="score-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px', padding: '24px', backgroundColor: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border)' }}>
                        <h2 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-muted)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Dumbbell size={16} /> Last Session
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                            <ScoreRing score={lastWorkout.score.overall} size={100} strokeWidth={10} label="Score" />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ fontSize: '13px', color: 'var(--color-text-main)', display: 'flex', justifyContent: 'space-between', width: '120px' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Progression</span>
                                    <span style={{ fontWeight: 600 }}>{lastWorkout.score.progression}</span>
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--color-text-main)', display: 'flex', justifyContent: 'space-between', width: '120px' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Consistency</span>
                                    <span style={{ fontWeight: 600 }}>{lastWorkout.score.consistency}</span>
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--color-text-main)', display: 'flex', justifyContent: 'space-between', width: '120px' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Quality</span>
                                    <span style={{ fontWeight: 600 }}>{lastWorkout.score.quality}</span>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                <section>
                    <WeeklyViewCard
                        plan={plan}
                        templates={templates || []}
                        histories={thisWeekHistories || []}
                        onAdjustWeek={() => setIsAdjustModalOpen(true)}
                        onStartToday={(template) => {
                            if (isActive) {
                                setTemplateToStart(template);
                                return;
                            }
                            startWorkout(template.name, template.id);
                            const freshExercises = template.exercises.map(ex => ({
                                ...ex,
                                id: `we-${generateId()}`,
                                sets: ex.sets.map(s => ({ ...s, isDone: false }))
                            }));
                            updateExercises(freshExercises);
                            navigate('/workout');
                        }}
                    />
                </section>

                {plan.weeklyScore !== undefined && (
                    <section style={{
                        padding: '14px 16px',
                        backgroundColor: 'var(--color-surface)',
                        borderRadius: '12px',
                        border: '1px solid var(--color-border)',
                        marginBottom: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Week Score
                            </p>
                            <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                Based on your adherence &amp; recovery
                            </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{
                                fontSize: '26px',
                                fontWeight: 800,
                                color: plan.weeklyScore >= 80 ? '#10b981' : plan.weeklyScore >= 60 ? '#f59e0b' : '#ef4444',
                            }}>
                                {plan.weeklyScore}
                            </span>
                            <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>/100</span>
                        </div>
                    </section>
                )}

                <section>
                    <button
                        className="checkin-trigger-btn"
                        onClick={() => setIsCheckInModalOpen(true)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', fontWeight: 600, marginBottom: '16px', cursor: 'pointer', transition: 'all 0.2s ease' }}
                    >
                        <Sparkles size={18} />
                        Plan with AI Coach
                    </button>
                </section>

                <section className="action-section">
                    <button
                        className="start-workout-btn"
                        onClick={() => {
                            if (nextTemplateToDo && nextTemplateToDo.originalTemplate) {
                                if (isActive) {
                                    setTemplateToStart(nextTemplateToDo.originalTemplate);
                                    return;
                                }
                                startWorkout(nextTemplateToDo.originalTemplate.name, nextTemplateToDo.templateId);
                                const freshExercises = nextTemplateToDo.originalTemplate.exercises.map(ex => ({
                                    ...ex,
                                    id: `we-${generateId()}`,
                                    sets: ex.sets.map(s => ({ ...s, isDone: false }))
                                }));
                                updateExercises(freshExercises);
                            } else {
                                startWorkout();
                            }
                            navigate('/workout');
                        }}
                    >
                        <Play size={24} fill="currentColor" />
                        <span>{nextTemplateToDo ? `Start ${nextTemplateToDo.name}` : 'Start Empty Workout'}</span>
                    </button>
                </section>

                {templates && templates.length > 0 && (
                    <section className="templates-section" style={{ marginTop: '16px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Bookmark size={20} className="icon-main" />
                            Your Templates
                        </h2>
                        <div className="templates-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {templates.map(template => (
                                <div
                                    key={template.id}
                                    style={{ backgroundColor: 'var(--color-surface)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                    onClick={() => {
                                        if (isActive) {
                                            setTemplateToStart(template);
                                            return;
                                        }
                                        startWorkout(template.name, template.id);
                                        // create fresh instances of sets for the new session
                                        const freshExercises = template.exercises.map(ex => ({
                                            ...ex,
                                            id: `we-${generateId()}`,
                                            sets: ex.sets.map(s => ({ ...s, isDone: false }))
                                        }));
                                        updateExercises(freshExercises);
                                        navigate('/workout');
                                    }}
                                >
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--color-text-main)' }}>{template.name}</h3>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-muted)' }}>{template.exercises.length} exercises</p>
                                    </div>
                                    <Play size={20} color="var(--color-primary)" />
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {isAdjustModalOpen && (
                <AdjustWeekModal
                    currentPlan={plan}
                    onClose={() => setIsAdjustModalOpen(false)}
                />
            )}

            {templateToStart && (
                <div
                    style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setTemplateToStart(null)}
                >
                    <div
                        style={{ backgroundColor: 'var(--color-surface)', borderRadius: '20px 20px 0 0', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--color-text-main)' }}>Replace current workout?</h3>
                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)' }}>Starting <strong style={{ color: 'var(--color-text-main)' }}>{templateToStart.name}</strong> will discard your current session.</p>
                        <button
                            style={{ padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#fff', fontSize: '16px', fontWeight: 700, cursor: 'pointer', marginTop: '4px' }}
                            onClick={() => {
                                startWorkout(templateToStart.name, templateToStart.id);
                                const freshExercises = templateToStart.exercises.map(ex => ({
                                    ...ex,
                                    id: `we-${generateId()}`,
                                    sets: ex.sets.map(s => ({ ...s, isDone: false }))
                                }));
                                updateExercises(freshExercises);
                                setTemplateToStart(null);
                                navigate('/workout');
                            }}
                        >
                            Replace &amp; Start
                        </button>
                        <button
                            style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-muted)', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}
                            onClick={() => setTemplateToStart(null)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {isCheckInModalOpen && profile && (
                <WeeklyCheckInModal
                    profile={profile}
                    onClose={() => setIsCheckInModalOpen(false)}
                />
            )}
        </div>
    );
}
