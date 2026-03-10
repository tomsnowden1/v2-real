import { useState, useEffect } from 'react';
import {
    Activity, Zap, Target, Flame, ShieldCheck, CalendarDays, MapPin,
    Clock, Dumbbell, TrendingUp, AlertTriangle, Moon, Brain,
} from 'lucide-react';
import type { UserProfile } from '../../db/database';
import { saveUserProfile } from '../../db/userProfileService';
import { getAllGyms } from '../../db/gymService';
import WizardShell from './WizardShell';
import OptionCardGrid from './OptionCardGrid';
import { useAIProvider } from '../../hooks/useAIProvider';
import { runOnboardingCompletion } from '../../lib/onboardingOrchestrator';

// ── Constants ─────────────────────────────────────────────────────────────────

const GOALS = [
    { id: 'Consistency/Newborn' as UserProfile['goal'], title: 'Consistency & Routine', desc: 'Building a habit from scratch. Focus on showing up regularly.', icon: <Activity size={24} />, color: '#3b82f6' },
    { id: 'Strength' as UserProfile['goal'], title: 'Max Strength', desc: 'Moving heavy weight. Focus on central nervous system adaptation.', icon: <Zap size={24} />, color: '#eab308' },
    { id: 'Hypertrophy' as UserProfile['goal'], title: 'Hypertrophy', desc: 'Building muscle mass. Focus on volume and time under tension.', icon: <Target size={24} />, color: '#10b981' },
    { id: 'Fat loss/Conditioning' as UserProfile['goal'], title: 'Fat Loss & Cardio', desc: 'Leaning out. Focus on high activity and metabolic conditioning.', icon: <Flame size={24} />, color: '#ef4444' },
];

const ACTIVITY_LEVELS = [
    { id: 'Sedentary', title: 'Mostly Sitting', desc: 'Desk job, minimal movement outside workouts.', icon: <Brain size={24} />, color: '#6b7280' },
    { id: 'Lightly Active', title: 'Lightly Active', desc: 'Some daily walking, light tasks.', icon: <Activity size={24} />, color: '#3b82f6' },
    { id: 'Moderately Active', title: 'Moderately Active', desc: 'On my feet a lot, regular movement.', icon: <TrendingUp size={24} />, color: '#10b981' },
    { id: 'Very Active', title: 'Very Active', desc: 'Physical job or daily cardio on top of training.', icon: <Zap size={24} />, color: '#ef4444' },
];

const DAYS_OPTIONS = [
    { id: '2', title: '2 Days', desc: 'Casual — great for busy weeks or building the habit.', icon: <CalendarDays size={24} />, color: '#3b82f6' },
    { id: '3', title: '3 Days', desc: 'Consistent — the most common effective frequency.', icon: <CalendarDays size={24} />, color: '#10b981' },
    { id: '4', title: '4 Days', desc: 'Dedicated — serious about results.', icon: <CalendarDays size={24} />, color: '#f59e0b' },
    { id: '5', title: '5 Days', desc: 'Athlete — high commitment, high reward.', icon: <CalendarDays size={24} />, color: '#ef4444' },
];

const SESSION_DURATIONS = ['30min', '45min', '60min', '90min+'] as const;
type SessionDuration = typeof SESSION_DURATIONS[number];

const TRAINING_STYLES = [
    'Heavy compound lifts',
    'Machine & isolation work',
    'HIIT & circuits',
    'Functional / athletic',
    'Bodyweight',
    'No strong preference',
];

const CONSISTENCY_BLOCKERS = [
    'Fatigue / low energy',
    'Lack of time',
    'Boredom with routine',
    'Travel or schedule changes',
    'Soreness or injury',
    'Gym access / equipment',
    'I rarely skip',
];

const SLEEP_OPTIONS = ['<6', '6-7', '7-8', '8+'] as const;
type SleepHours = typeof SLEEP_OPTIONS[number];

const STRESS_OPTIONS = ['Low', 'Moderate', 'High'] as const;
type StressLevel = typeof STRESS_OPTIONS[number];

// ── Types ─────────────────────────────────────────────────────────────────────

type ArchitectStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

interface Props {
    profile: UserProfile;
}

// ── Chip component ────────────────────────────────────────────────────────────

function ChipGroup({
    options,
    selected,
    onToggle,
    multiSelect = false,
    color = 'var(--color-primary)',
}: {
    options: string[];
    selected: string[];
    onToggle: (id: string) => void;
    multiSelect?: boolean;
    color?: string;
}) {
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
            {options.map((opt) => {
                const isSelected = selected.includes(opt);
                return (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => onToggle(opt)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '999px',
                            border: isSelected ? `2px solid ${color}` : '2px solid var(--color-border)',
                            backgroundColor: isSelected ? `${color}18` : 'var(--color-surface)',
                            color: isSelected ? color : 'var(--color-text-muted)',
                            fontWeight: isSelected ? 700 : 400,
                            fontSize: '14px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {opt}
                    </button>
                );
            })}
            {multiSelect && (
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', alignSelf: 'center', marginLeft: '4px' }}>
                    Select all that apply
                </span>
            )}
        </div>
    );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ArchitectIntakeWizard({ profile }: Props) {
    const { config, provider } = useAIProvider();

    const [step, setStep] = useState<ArchitectStep>(1);
    const [selectedGoal, setSelectedGoal] = useState<UserProfile['goal']>(profile.goal);
    const [motivation, setMotivation] = useState('');
    const [selectedActivityLevel, setSelectedActivityLevel] = useState<string | null>(null);
    const [selectedDays, setSelectedDays] = useState<string>(String(profile.targetWorkoutDays ?? 3));
    const [selectedSessionDuration, setSelectedSessionDuration] = useState<SessionDuration | null>(null);
    const [selectedTrainingStyles, setSelectedTrainingStyles] = useState<string[]>([]);
    const [selectedBlockers, setSelectedBlockers] = useState<string[]>([]);
    const [selectedSleepHours, setSelectedSleepHours] = useState<SleepHours | null>(null);
    const [selectedStressLevel, setSelectedStressLevel] = useState<StressLevel | null>(null);
    const [personalContext, setPersonalContext] = useState('');
    const [gymName, setGymName] = useState<string | null>(null);
    const [gymEquipmentCount, setGymEquipmentCount] = useState<number>(0);
    const [isSaving, setIsSaving] = useState(false);

    const isBeginner = profile.experienceLevel === 'Beginner';
    const wantsRecoveryDetail = selectedGoal === 'Strength' || selectedGoal === 'Hypertrophy';

    // Load gym summary for Equipment Check step
    useEffect(() => {
        getAllGyms().then(gyms => {
            if (gyms.length > 0) {
                setGymName(gyms[0].name);
                setGymEquipmentCount(gyms[0].availableEquipmentIds.length);
            }
        }).catch(() => {});
    }, []);

    const toggleChip = (
        val: string,
        current: string[],
        setter: React.Dispatch<React.SetStateAction<string[]>>,
        multiSelect: boolean
    ) => {
        if (multiSelect) {
            setter(current.includes(val) ? current.filter(v => v !== val) : [...current, val]);
        } else {
            setter([val]);
        }
    };

    const handleCommit = async () => {
        if (isSaving) return;
        setIsSaving(true);
        setStep(11);

        try {
            const days = parseInt(selectedDays, 10);

            const profileToSave: UserProfile = {
                ...profile,
                goal: selectedGoal,
                targetWorkoutDays: days,
                motivation: motivation.trim(),
                accountabilityStatement: `I am training for ${selectedGoal} because: ${motivation.trim()}`,
                currentBlockWeek: 1,
                isBeginner: profile.isBeginnerNoWeights ?? false,
                sessionDuration: selectedSessionDuration ?? undefined,
                currentActivityLevel: (selectedActivityLevel as UserProfile['currentActivityLevel']) ?? undefined,
                exercisePreferences: selectedTrainingStyles.length > 0
                    ? selectedTrainingStyles.filter(s => s !== 'No strong preference').join(', ')
                    : undefined,
                consistencyBlockers: selectedBlockers.length > 0
                    ? selectedBlockers.filter(s => s !== 'I rarely skip')
                    : undefined,
                sleepHours: selectedSleepHours ?? undefined,
                stressLevel: selectedStressLevel ?? undefined,
                onboardingComplete: true,
                personalContext: personalContext.trim().slice(0, 300) || undefined,
            };

            // Run orchestrator first while the wizard loading screen is visible.
            // The orchestrator writes a welcome message to Dexie and generates week 1 templates.
            await runOnboardingCompletion(profileToSave, provider, config);

            // Point the router at /coach so BrowserRouter mounts there when the overlay disappears.
            window.history.replaceState(null, '', '/coach');

            // Save the profile last — this sets `motivation` which triggers GoalSelectionGuard
            // to render the app. The wizard overlay unmounts and Coach.tsx shows the welcome message.
            await saveUserProfile(profileToSave);

        } catch (err) {
            console.error('[ArchitectIntakeWizard] Commit error', err);
            // Fallback: save at minimum fields so user can access the app
            window.history.replaceState(null, '', '/coach');
            await saveUserProfile({
                ...profile,
                goal: selectedGoal,
                targetWorkoutDays: parseInt(selectedDays, 10),
                motivation: motivation.trim(),
                accountabilityStatement: `I am training for ${selectedGoal} because: ${motivation.trim()}`,
                currentBlockWeek: 1,
                isBeginner: profile.isBeginnerNoWeights ?? false,
            });
        }
    };

    const goalLabel = GOALS.find(g => g.id === selectedGoal)?.title ?? selectedGoal;
    const motivationTooShort = motivation.trim().length < 10;

    // Determine step flow (accounting for beginner branching)
    // Step 5 (training preferences) is skipped for beginners → go 4 → 6
    const nextAfterStep4 = isBeginner ? 6 : 5;
    const prevStep5 = isBeginner ? 4 : 5;

    // Step 7 (sleep/stress) skipped for Consistency goal without asking recovery detail
    const showRecoveryDetail = wantsRecoveryDetail;
    const nextAfterStep6 = showRecoveryDetail ? 7 : 8;
    const prevStep7Or8 = showRecoveryDetail ? 7 : 8;

    // Calculate total visible steps (accounting for skips)
    const getTotalVisibleSteps = (): number => {
        let count = 9; // Base: steps 1,2,3,4,6,8,9,10 (excluding 5 and 7) — step 9=personal context, step 10=manifesto
        if (!isBeginner) count++; // Add step 5 if not beginner
        if (showRecoveryDetail) count++; // Add step 7 if Strength/Hypertrophy
        return count;
    };

    // Generate dots array where current step is marked as true
    const generateDots = (): boolean[] => {
        const totalSteps = getTotalVisibleSteps();
        const dots = new Array(totalSteps).fill(false);

        // Map actual step numbers to visible step indices
        let visibleIndex = 0;
        const visibleStepNumbers = [1, 2, 3, 4];
        if (!isBeginner) visibleStepNumbers.push(5);
        visibleStepNumbers.push(6);
        if (showRecoveryDetail) visibleStepNumbers.push(7);
        visibleStepNumbers.push(8, 9, 10);

        if (visibleStepNumbers.includes(step)) {
            visibleIndex = visibleStepNumbers.indexOf(step);
            dots[visibleIndex] = true;
        }

        return dots;
    };

    const dots = generateDots();

    // ── STEP 11: LOADING ──────────────────────────────────────────────────────
    if (step === 11) {
        return (
            <WizardShell title="Building your program..." subtitle="Coach is setting up your first week. This usually takes 5–10 seconds.">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', paddingTop: '32px' }}>
                    <div style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(var(--color-primary-rgb, 99,102,241), 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Activity size={36} color="var(--color-primary)" className="spin-slow" />
                    </div>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', textAlign: 'center', maxWidth: '280px', lineHeight: 1.6 }}>
                        Personalising your {selectedDays}-day {goalLabel.toLowerCase()} plan based on your profile…
                    </p>
                </div>
            </WizardShell>
        );
    }

    // ── STEP 1: THE GOAL ──────────────────────────────────────────────────────
    if (step === 1) {
        return (
            <WizardShell
                title="Your Mission"
                subtitle="The Coach builds your entire program around this. Choose what you are actually training for right now."
                dots={dots}
            >
                <OptionCardGrid
                    options={GOALS.map(g => ({ ...g, id: g.id! }))}
                    selected={selectedGoal}
                    onSelect={(id) => setSelectedGoal(id as UserProfile['goal'])}
                />
                <button className="goal-save-btn" disabled={!selectedGoal} onClick={() => setStep(2)}>
                    Next
                </button>
            </WizardShell>
        );
    }

    // ── STEP 2: THE "WHY" ─────────────────────────────────────────────────────
    if (step === 2) {
        return (
            <WizardShell
                onBack={() => setStep(1)}
                title="Why does this matter?"
                subtitle="This is the most important question. Your Coach will use this to challenge you when things get hard."
                dots={dots}
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
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '8px 0 0 0', lineHeight: 1.5 }}>
                        Your Coach will reference this if you start missing sessions or lose motivation.
                    </p>
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

    // ── STEP 3: CURRENT ACTIVITY LEVEL ───────────────────────────────────────
    if (step === 3) {
        return (
            <WizardShell
                onBack={() => setStep(2)}
                title="How active are you outside the gym?"
                subtitle="This helps the Coach calibrate your starting volume — not just your workout frequency."
                dots={dots}
            >
                <OptionCardGrid
                    options={ACTIVITY_LEVELS}
                    selected={selectedActivityLevel}
                    onSelect={(id) => setSelectedActivityLevel(id)}
                    singleCol
                />
                <button
                    className="goal-save-btn button-margin-top-large"
                    disabled={!selectedActivityLevel}
                    onClick={() => setStep(4)}
                >
                    Next
                </button>
            </WizardShell>
        );
    }

    // ── STEP 4: DAYS/WEEK + SESSION DURATION ──────────────────────────────────
    if (step === 4) {
        return (
            <WizardShell
                onBack={() => setStep(3)}
                title="Time & Schedule"
                subtitle="Be realistic. A plan you can keep beats a perfect plan you can't."
                dots={dots}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                        <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Training days per week
                        </p>
                        <OptionCardGrid
                            options={DAYS_OPTIONS}
                            selected={selectedDays}
                            onSelect={(id) => setSelectedDays(id)}
                            singleCol
                        />
                    </div>
                    <div>
                        <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <Clock size={13} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                            Session length
                        </p>
                        <ChipGroup
                            options={[...SESSION_DURATIONS]}
                            selected={selectedSessionDuration ? [selectedSessionDuration] : []}
                            onToggle={(val) => setSelectedSessionDuration(val as SessionDuration)}
                        />
                    </div>
                </div>
                <button
                    className="goal-save-btn button-margin-top-large"
                    disabled={!selectedDays || !selectedSessionDuration}
                    onClick={() => setStep(nextAfterStep4)}
                >
                    Next
                </button>
            </WizardShell>
        );
    }

    // ── STEP 5: TRAINING PREFERENCES (skip for beginners) ────────────────────
    if (step === 5) {
        return (
            <WizardShell
                onBack={() => setStep(4)}
                title="What kind of training do you enjoy?"
                subtitle="Your Coach will lean into what you already like and avoid what you hate."
                dots={dots}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <Dumbbell size={13} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                            I enjoy
                        </p>
                        <ChipGroup
                            options={TRAINING_STYLES}
                            selected={selectedTrainingStyles}
                            onToggle={(val) => toggleChip(val, selectedTrainingStyles, setSelectedTrainingStyles, true)}
                            multiSelect
                            color="#10b981"
                        />
                    </div>
                </div>
                <button
                    className="goal-save-btn button-margin-top-large"
                    disabled={selectedTrainingStyles.length === 0}
                    onClick={() => setStep(6)}
                >
                    Next
                </button>
            </WizardShell>
        );
    }

    // ── STEP 6: CONSISTENCY BLOCKERS ──────────────────────────────────────────
    if (step === 6) {
        return (
            <WizardShell
                onBack={() => setStep(prevStep5)}
                title="What usually makes you skip?"
                subtitle="Your Coach will design around your real life — not an imaginary version of it."
                dots={dots}
            >
                <div>
                    <ChipGroup
                        options={CONSISTENCY_BLOCKERS}
                        selected={selectedBlockers}
                        onToggle={(val) => toggleChip(val, selectedBlockers, setSelectedBlockers, true)}
                        multiSelect
                        color="#f59e0b"
                    />
                </div>
                <button
                    className="goal-save-btn button-margin-top-large"
                    disabled={selectedBlockers.length === 0}
                    onClick={() => setStep(nextAfterStep6)}
                >
                    Next
                </button>
            </WizardShell>
        );
    }

    // ── STEP 7: RECOVERY (only for Strength / Hypertrophy goals) ─────────────
    if (step === 7) {
        return (
            <WizardShell
                onBack={() => setStep(6)}
                title="Recovery check"
                subtitle="Recovery is half the work. A quick picture helps the Coach set safe volume."
                dots={dots}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                        <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <Moon size={13} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                            Average sleep per night
                        </p>
                        <ChipGroup
                            options={[...SLEEP_OPTIONS]}
                            selected={selectedSleepHours ? [selectedSleepHours] : []}
                            onToggle={(val) => setSelectedSleepHours(val as SleepHours)}
                            color="#8b5cf6"
                        />
                    </div>
                    <div>
                        <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <AlertTriangle size={13} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                            Day-to-day stress level
                        </p>
                        <ChipGroup
                            options={[...STRESS_OPTIONS]}
                            selected={selectedStressLevel ? [selectedStressLevel] : []}
                            onToggle={(val) => setSelectedStressLevel(val as StressLevel)}
                            color="#ef4444"
                        />
                    </div>
                    {(selectedSleepHours === '<6' || selectedStressLevel === 'High') && (
                        <div style={{
                            padding: '12px 16px',
                            backgroundColor: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: '10px',
                            fontSize: '13px',
                            color: 'var(--color-text-muted)',
                            lineHeight: 1.6,
                        }}>
                            <strong style={{ color: '#f59e0b' }}>Noted.</strong> Your Coach will keep volume conservative until recovery improves. That's not a limitation — it's smarter programming.
                        </div>
                    )}
                </div>
                <button
                    className="goal-save-btn button-margin-top-large"
                    disabled={!selectedSleepHours || !selectedStressLevel}
                    onClick={() => setStep(8)}
                >
                    Next
                </button>
            </WizardShell>
        );
    }

    // ── STEP 8: EQUIPMENT CHECK ───────────────────────────────────────────────
    if (step === 8) {
        return (
            <WizardShell
                onBack={() => setStep(prevStep7Or8)}
                title="Your Training Space"
                subtitle="The Coach will only assign exercises you can actually do."
                dots={dots}
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
                            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                                No gym profile set up yet. No problem — the Coach will assume standard commercial gym equipment for now.
                                You can set up a detailed profile anytime in <strong>Settings → Gym Profiles</strong>.
                            </p>
                        </div>
                    )}
                </div>
                <button className="goal-save-btn button-margin-top-large" onClick={() => setStep(9)}>
                    Looks good — continue
                </button>
            </WizardShell>
        );
    }

    // ── STEP 9: PERSONAL CONTEXT ──────────────────────────────────────────────
    if (step === 9) {
        return (
            <WizardShell
                onBack={() => setStep(8)}
                title="Anything else?"
                subtitle="Optional — but the more your Coach knows, the smarter your first week will be."
                dots={dots}
            >
                <div className="preferences-container preferences-container-flex">
                    <textarea
                        value={personalContext}
                        onChange={(e) => setPersonalContext(e.target.value.slice(0, 300))}
                        placeholder="e.g. bad lower back, travel 2 weeks a month, can't do overhead pressing, hate cardio, recovering from shoulder surgery..."
                        className="textarea-styled"
                        style={{ minHeight: '100px' }}
                        maxLength={300}
                    />
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '6px 0 0 0', lineHeight: 1.5 }}>
                        {personalContext.length}/300 characters — injuries, limitations, travel habits, dislikes. Your Coach treats this as hard constraints.
                    </p>
                </div>
                <button
                    className="goal-save-btn button-margin-top-large"
                    onClick={() => setStep(10)}
                >
                    {personalContext.trim() ? 'Continue' : 'Skip'}
                </button>
            </WizardShell>
        );
    }

    // ── STEP 10: MANIFESTO + COMMIT ───────────────────────────────────────────
    if (step === 10) {
    return (
        <WizardShell
            onBack={() => setStep(9)}
            title="Your Program"
            subtitle="Here is what the next 6 weeks look like."
            dots={dots}
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
                    gap: '10px',
                }}>
                    {[
                        { label: 'Goal', value: goalLabel },
                        { label: 'Days / Week', value: selectedDays },
                        { label: 'Session Length', value: selectedSessionDuration ?? '—' },
                        { label: 'Activity Level', value: selectedActivityLevel ?? '—' },
                        selectedTrainingStyles.length > 0 ? { label: 'Preferences', value: selectedTrainingStyles.filter(s => s !== 'No strong preference').join(', ') || 'None specified' } : null,
                        selectedBlockers.filter(b => b !== 'I rarely skip').length > 0 ? { label: 'Blockers noted', value: selectedBlockers.filter(b => b !== 'I rarely skip').join(', ') } : null,
                        personalContext.trim() ? { label: 'Coach notes', value: personalContext.trim() } : null,
                    ].filter(Boolean).map((row, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>{row!.label}</span>
                            <span style={{ fontWeight: 600, color: 'var(--color-text-main)', textAlign: 'right', fontSize: '14px' }}>{row!.value}</span>
                        </div>
                    ))}
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '10px', marginTop: '2px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your Why</span>
                        <p style={{ margin: '6px 0 0 0', fontStyle: 'italic', color: 'var(--color-text-main)', fontSize: '14px', lineHeight: 1.5 }}>
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
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
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
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
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
                {isSaving ? 'Building your program...' : 'I Commit'}
            </button>
        </WizardShell>
    );
    }
    return null;
}
