import { useState, useEffect } from 'react';
import { Activity, Zap, Target, Flame, ShieldCheck, CalendarDays, MapPin } from 'lucide-react';
import type { UserProfile } from '../../db/database';
import { saveUserProfile } from '../../db/userProfileService';
import { getAllGyms } from '../../db/gymService';
import WizardShell from './WizardShell';
import OptionCardGrid from './OptionCardGrid';

// ── Constants ─────────────────────────────────────────────────────────────────

const GOALS = [
    { id: 'Consistency/Newborn' as UserProfile['goal'], title: 'Consistency & Routine', desc: 'Building a habit from scratch. Focus on showing up regularly.', icon: <Activity size={24} />, color: '#3b82f6' },
    { id: 'Strength' as UserProfile['goal'], title: 'Max Strength', desc: 'Moving heavy weight. Focus on central nervous system adaptation.', icon: <Zap size={24} />, color: '#eab308' },
    { id: 'Hypertrophy' as UserProfile['goal'], title: 'Hypertrophy', desc: 'Building muscle mass. Focus on volume and time under tension.', icon: <Target size={24} />, color: '#10b981' },
    { id: 'Fat loss/Conditioning' as UserProfile['goal'], title: 'Fat Loss & Cardio', desc: 'Leaning out. Focus on high activity and metabolic conditioning.', icon: <Flame size={24} />, color: '#ef4444' },
];

const DAYS_OPTIONS = [
    { id: '2', title: '2 Days', desc: 'Casual — great for busy weeks or active recovery.', icon: <CalendarDays size={24} />, color: '#3b82f6' },
    { id: '3', title: '3 Days', desc: 'Consistent — the most common effective frequency.', icon: <CalendarDays size={24} />, color: '#10b981' },
    { id: '4', title: '4 Days', desc: 'Dedicated — serious about results.', icon: <CalendarDays size={24} />, color: '#f59e0b' },
    { id: '5', title: '5 Days', desc: 'Athlete — high commitment, high reward.', icon: <CalendarDays size={24} />, color: '#ef4444' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type ArchitectStep = 1 | 2 | 3 | 4 | 5;

interface Props {
    profile: UserProfile;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ArchitectIntakeWizard({ profile }: Props) {
    const [step, setStep] = useState<ArchitectStep>(1);
    const [selectedGoal, setSelectedGoal] = useState<UserProfile['goal']>(profile.goal);
    const [motivation, setMotivation] = useState('');
    const [selectedDays, setSelectedDays] = useState<string>(String(profile.targetWorkoutDays ?? 3));
    const [gymName, setGymName] = useState<string | null>(null);
    const [gymEquipmentCount, setGymEquipmentCount] = useState<number>(0);
    const [isSaving, setIsSaving] = useState(false);

    // Load gym summary for Equipment Check step
    useEffect(() => {
        getAllGyms().then(gyms => {
            if (gyms.length > 0) {
                setGymName(gyms[0].name);
                setGymEquipmentCount(gyms[0].availableEquipmentIds.length);
            }
        }).catch(() => {});
    }, []);

    const handleCommit = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            const days = parseInt(selectedDays, 10);
            await saveUserProfile({
                ...profile,
                goal: selectedGoal,
                targetWorkoutDays: days,
                motivation: motivation.trim(),
                accountabilityStatement: `I am training for ${selectedGoal} because: ${motivation.trim()}`,
                currentBlockWeek: 1,
                isBeginner: profile.isBeginnerNoWeights ?? false,
            });
            // useLiveQuery in GoalSelectionGuard will detect motivation is now set
            // and automatically show <children> — no callback needed.
        } catch (err) {
            console.error('[ArchitectIntakeWizard] Save failed', err);
            setIsSaving(false);
        }
    };

    const goalLabel = GOALS.find(g => g.id === selectedGoal)?.title ?? selectedGoal;
    const motivationTooShort = motivation.trim().length < 10;

    // ── STEP 1: The Goal ──────────────────────────────────────────────────────
    if (step === 1) {
        return (
            <WizardShell
                title="Your Mission"
                subtitle="The Coach builds your entire program around this. Choose what you are actually training for right now."
            >
                <OptionCardGrid
                    options={GOALS.map(g => ({ ...g, id: g.id! }))}
                    selected={selectedGoal}
                    onSelect={(id) => setSelectedGoal(id as UserProfile['goal'])}
                />
                <button
                    className="goal-save-btn"
                    disabled={!selectedGoal}
                    onClick={() => setStep(2)}
                >
                    Next
                </button>
            </WizardShell>
        );
    }

    // ── STEP 2: The "Why" ──────────────────────────────────────────────────────
    if (step === 2) {
        return (
            <WizardShell
                onBack={() => setStep(1)}
                title="Why does this matter?"
                subtitle="This is the most important question. Your Coach will use this to challenge you when things get hard."
            >
                <div className="preferences-container preferences-container-flex">
                    <textarea
                        value={motivation}
                        onChange={(e) => setMotivation(e.target.value)}
                        placeholder="e.g. I want to feel strong and confident. I want to prove to myself I can commit to something hard."
                        className="textarea-styled"
                        style={{ minHeight: '120px' }}
                        autoFocus
                    />
                    {motivation.length > 0 && motivationTooShort && (
                        <p style={{ fontSize: '12px', color: '#f59e0b', margin: '4px 0 0 0' }}>
                            Tell us a little more — a few more words helps the Coach understand you.
                        </p>
                    )}
                </div>
                <button
                    className="goal-save-btn button-margin-top-large"
                    disabled={motivationTooShort}
                    onClick={() => setStep(3)}
                >
                    Next
                </button>
            </WizardShell>
        );
    }

    // ── STEP 3: The Commitment ────────────────────────────────────────────────
    if (step === 3) {
        return (
            <WizardShell
                onBack={() => setStep(2)}
                title="How many days per week?"
                subtitle="Be honest. A plan you can keep beats a perfect plan you can't."
            >
                <OptionCardGrid
                    options={DAYS_OPTIONS}
                    selected={selectedDays}
                    onSelect={(id) => setSelectedDays(id)}
                    singleCol
                />
                <button
                    className="goal-save-btn button-margin-top-large"
                    disabled={!selectedDays}
                    onClick={() => setStep(4)}
                >
                    Next
                </button>
            </WizardShell>
        );
    }

    // ── STEP 4: Equipment Check ───────────────────────────────────────────────
    if (step === 4) {
        return (
            <WizardShell
                onBack={() => setStep(3)}
                title="Your Training Space"
                subtitle="The Coach will only assign exercises you can actually do."
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '8px' }}>
                    {gymName ? (
                        <div style={{
                            padding: '20px',
                            backgroundColor: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                        }}>
                            <MapPin size={28} color="#10b981" />
                            <div>
                                <p style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: 'var(--color-text-main)' }}>
                                    {gymName}
                                </p>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                                    {gymEquipmentCount} pieces of equipment configured
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            padding: '20px',
                            backgroundColor: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            borderRadius: '16px',
                        }}>
                            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)' }}>
                                No gym profile set up yet. No problem — the Coach will ask about your equipment when planning workouts.
                                You can set it up anytime in Settings → Gym Profiles.
                            </p>
                        </div>
                    )}
                </div>
                <button
                    className="goal-save-btn button-margin-top-large"
                    onClick={() => setStep(5)}
                >
                    Looks good — continue
                </button>
            </WizardShell>
        );
    }

    // ── STEP 5: The Manifesto ─────────────────────────────────────────────────
    return (
        <WizardShell
            onBack={() => setStep(4)}
            title="Your Program"
            subtitle="Here is what the next 6 weeks look like."
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Summary card */}
                <div style={{
                    padding: '20px',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Goal</span>
                        <span style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>{goalLabel}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Days / Week</span>
                        <span style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>{selectedDays}</span>
                    </div>
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your Why</span>
                        <p style={{ margin: '6px 0 0 0', fontStyle: 'italic', color: 'var(--color-text-main)', fontSize: '14px', lineHeight: '1.5' }}>
                            "{motivation}"
                        </p>
                    </div>
                </div>

                {/* Science blurb */}
                <div style={{
                    padding: '16px',
                    backgroundColor: 'rgba(139, 92, 246, 0.08)',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    borderRadius: '12px',
                }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#8b5cf6', marginBottom: '8px' }}>
                        📐 The Science: Volume Ramping
                    </p>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.6' }}>
                        Your program uses a <strong>6-week block</strong>: Week 1 starts lighter so your body adapts,
                        builds up through weeks 2–5 to push you to a peak, then week 6 is a planned lighter week
                        so you recover and come back stronger. This cycle then repeats.
                    </p>
                </div>

                {/* Accountability note */}
                <div style={{
                    padding: '16px',
                    backgroundColor: 'rgba(239, 68, 68, 0.06)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '12px',
                }}>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.6' }}>
                        <ShieldCheck size={14} style={{ display: 'inline', marginRight: '6px', color: '#ef4444' }} />
                        Your Coach will hold you to this. If you try to skip days or change goals before the 6 weeks are done,
                        expect a direct conversation. That's what you signed up for.
                    </p>
                </div>
            </div>

            <button
                className="goal-save-btn button-margin-top-large"
                disabled={isSaving}
                onClick={handleCommit}
                style={{ backgroundColor: '#10b981', fontSize: '17px', fontWeight: 800, letterSpacing: '0.3px' }}
            >
                {isSaving ? 'Saving...' : 'I Commit'}
            </button>
        </WizardShell>
    );
}
