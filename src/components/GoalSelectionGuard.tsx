import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getUserProfile, saveUserProfile } from '../db/userProfileService';
import { db } from '../db/database';
import { generateId } from '../lib/id';
import { EQUIPMENT_DB } from '../db/equipment';
import {
    Target, Activity, Zap, Flame, HeartHandshake, ArrowRight, ShieldAlert,
    GraduationCap, Dumbbell, Trophy, Building2, Home as HomeIcon, User, CalendarDays, FileText,
    BrainCircuit, BarChart3, Warehouse, CalendarCheck
} from 'lucide-react';
import type { UserProfile, StrengthBaselines } from '../db/database';
import WizardShell from './wizard/WizardShell';
import OptionCardGrid from './wizard/OptionCardGrid';
import StrengthBaselineStep from './wizard/StrengthBaselineStep';
import ArchitectIntakeWizard from './wizard/ArchitectIntakeWizard';
import './GoalSelectionGuard.css';

const GOALS = [
    { id: 'Consistency/Newborn' as UserProfile['goal'], title: 'Consistency & Routine', desc: 'Building a habit from scratch. Focus on showing up regularly.', icon: <Activity size={24} />, color: '#3b82f6' },
    { id: 'Strength' as UserProfile['goal'], title: 'Max Strength', desc: 'Moving heavy weight. Focus on central nervous system adaptation.', icon: <Zap size={24} />, color: '#eab308' },
    { id: 'Hypertrophy' as UserProfile['goal'], title: 'Hypertrophy', desc: 'Building muscle mass. Focus on volume and time under tension.', icon: <Target size={24} />, color: '#10b981' },
    { id: 'Fat loss/Conditioning' as UserProfile['goal'], title: 'Fat Loss & Cardio', desc: 'Leaning out. Focus on high activity and metabolic conditioning.', icon: <Flame size={24} />, color: '#ef4444' },
];

const EXPERIENCES = [
    { id: 'Beginner' as NonNullable<UserProfile['experienceLevel']>, title: 'Beginner', desc: 'New to lifting. Focus on technique and building a habit.', icon: <GraduationCap size={24} />, color: '#10b981' },
    { id: 'Intermediate' as NonNullable<UserProfile['experienceLevel']>, title: 'Intermediate', desc: 'Can execute standard lifts correctly. Looking to push numbers.', icon: <Dumbbell size={24} />, color: '#3b82f6' },
    { id: 'Advanced' as NonNullable<UserProfile['experienceLevel']>, title: 'Advanced', desc: 'Experienced lifter needing specific programming and load management.', icon: <Trophy size={24} />, color: '#8b5cf6' },
];

const EQUIPMENTS = [
    { id: 'commercial', title: 'Commercial Gym', desc: 'Access to full range of machines, cables, and free weights.', icon: <Building2 size={24} />, color: '#3b82f6' },
    { id: 'home', title: 'Home Gym', desc: 'Basic setup with a rack, barbell, and some dumbbells.', icon: <HomeIcon size={24} />, color: '#10b981' },
    { id: 'bodyweight', title: 'Bodyweight Only', desc: 'No equipment besides maybe a pull-up bar or dip station.', icon: <User size={24} />, color: '#f59e0b' },
] as const;

const PERSONAS = [
    { id: 'Supportive' as NonNullable<UserProfile['coachPersona']>, title: 'Supportive', desc: 'Encouraging, positive, and empathetic. Focuses on consistency and effort over raw numbers.', icon: <HeartHandshake size={24} />, color: '#10b981' },
    { id: 'Direct' as NonNullable<UserProfile['coachPersona']>, title: 'Direct & Concise', desc: 'No fluff. Gives you the exact progression numbers and structured routines without small talk.', icon: <ArrowRight size={24} />, color: '#3b82f6' },
    { id: 'Hard friend' as NonNullable<UserProfile['coachPersona']>, title: 'Hard Friend', desc: 'Pushes you to your absolute limits. Demands intensity and calls out missed targets.', icon: <ShieldAlert size={24} />, color: '#ef4444' },
];

const SCHEDULES = [2, 3, 4, 5, 6];

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export default function GoalSelectionGuard({ children }: { children: React.ReactNode }) {
    const profile = useLiveQuery(() => getUserProfile().then(p => p || null));
    const [isChecking, setIsChecking] = useState(true);

    const [step, setStep] = useState<WizardStep>(0);
    const [selectedGoal, setSelectedGoal] = useState<UserProfile['goal'] | null>(null);
    const [selectedExperience, setSelectedExperience] = useState<UserProfile['experienceLevel'] | null>(null);
    const [selectedWeightUnit, setSelectedWeightUnit] = useState<'lbs' | 'kg'>('lbs');
    const [selectedBaselines, setSelectedBaselines] = useState<StrengthBaselines>({});
    const [isBeginnerNoWeights, setIsBeginnerNoWeights] = useState(false);
    const [selectedEquipment, setSelectedEquipment] = useState<'commercial' | 'home' | 'bodyweight' | null>(null);
    const [selectedDays, setSelectedDays] = useState<number | null>(3);
    const [selectedPersona, setSelectedPersona] = useState<UserProfile['coachPersona'] | null>(null);
    const [selectedPreferences, setSelectedPreferences] = useState('');

    useEffect(() => {
        if (profile !== undefined) {
            setIsChecking(false);
            if (profile?.goal) setSelectedGoal(profile.goal);
            if (profile?.experienceLevel) setSelectedExperience(profile.experienceLevel);
            if (profile?.targetWorkoutDays) setSelectedDays(profile.targetWorkoutDays);
            if (profile?.coachPersona) setSelectedPersona(profile.coachPersona);
            if (profile?.preferences !== undefined) setSelectedPreferences(profile.preferences);
        }
    }, [profile]);

    const handleDevSkip = async () => {
        const allEquip = EQUIPMENT_DB.map(e => e.id);
        const existingGyms = await db.gymProfiles.count();
        if (existingGyms === 0) {
            await db.gymProfiles.add({
                id: `gym-${generateId()}`,
                name: 'Commercial Gym',
                availableEquipmentIds: allEquip,
                customEquipment: []
            });
        }
        await saveUserProfile({
            goal: 'Strength',
            experienceLevel: 'Intermediate',
            targetWorkoutDays: 3,
            coachPersona: 'Direct',
            postWorkoutReview: 'Brief',
            theme: 'System',
            preferences: '',
            createdAt: Date.now(),
            weightUnit: 'lbs',
            strengthBaselines: {},
            isBeginnerNoWeights: false,
            weightSuggestionUI: 'autofill',
            motivation: 'dev skip',
            currentBlockWeek: 1,
            isBeginner: false,
            onboardingComplete: true,
        });
    };

    const handleSave = async () => {
        if (!selectedGoal || !selectedExperience || !selectedEquipment || !selectedDays || !selectedPersona) return;

        await saveUserProfile({
            goal: selectedGoal,
            experienceLevel: selectedExperience,
            targetWorkoutDays: selectedDays,
            coachPersona: selectedPersona,
            postWorkoutReview: 'Brief',
            theme: profile?.theme || 'System',
            preferences: selectedPreferences,
            createdAt: profile?.createdAt || Date.now(),
            weightUnit: selectedWeightUnit,
            strengthBaselines: isBeginnerNoWeights ? undefined : selectedBaselines,
            isBeginnerNoWeights,
            weightSuggestionUI: 'autofill',
        });

        const allEquip = EQUIPMENT_DB.map(e => e.id);
        const homeEquip = ['eq-barbell', 'eq-db-light', 'eq-db-heavy', 'eq-squat-rack', 'eq-pullup', 'eq-dip'];
        const bodyEquip = ['eq-pullup', 'eq-dip'];

        const equipIds = selectedEquipment === 'commercial' ? allEquip : selectedEquipment === 'home' ? homeEquip : bodyEquip;
        const gymName = selectedEquipment === 'commercial' ? 'Commercial Gym' : selectedEquipment === 'home' ? 'Home Gym' : 'Bodyweight / Park';

        const existingGyms = await db.gymProfiles.count();
        if (existingGyms === 0) {
            await db.gymProfiles.add({
                id: `gym-${generateId()}`,
                name: gymName,
                availableEquipmentIds: equipIds,
                customEquipment: []
            });
        }
    };

    if (isChecking) return <div className="goal-guard-loading">Loading profile...</div>;

    // Original wizard complete — check if Architect intake is still needed
    if (profile?.goal && profile?.coachPersona && profile?.experienceLevel && profile?.targetWorkoutDays) {
        // Second gate: Architect intake (runs once for existing users who haven't set motivation)
        if (!profile.motivation) {
            return (
                <div className="goal-selection-overlay">
                    <div className="goal-selection-container">
                        <ArchitectIntakeWizard profile={profile} />
                    </div>
                </div>
            );
        }
        // Fully onboarded — show the app
        return <>{children}</>;
    }

    return (
        <div className="goal-selection-overlay">
            <div className="goal-selection-container">

                {/* STEP 0: WELCOME */}
                {step === 0 && (
                    <div className="welcome-screen">
                        <div className="welcome-logo"><Dumbbell size={40} color="white" /></div>
                        <h1 className="welcome-title">Welcome to IronAI</h1>
                        <p className="welcome-subtitle">Your AI-powered workout coach that actually gets you</p>
                        <button className="welcome-start-btn" onClick={() => setStep(1)}>Get Started</button>
                        <button
                            onClick={handleDevSkip}
                            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '11px', opacity: 0.4, cursor: 'pointer', marginTop: '8px', padding: '4px 8px' }}
                        >
                            skip (dev)
                        </button>
                    </div>
                )}

                {/* STEP 1: FEATURES 1 */}
                {step === 1 && (
                    <div className="feature-screen">
                        <div className="step-dots">
                            <div className="step-dot active" />
                            <div className="step-dot" />
                        </div>
                        <div className="goal-header">
                            <h1>What IronAI Does</h1>
                            <p>Everything you need, nothing you don't</p>
                        </div>
                        <div className="feature-list">
                            <div className="feature-item">
                                <div className="feature-icon feature-icon-green"><BrainCircuit size={24} /></div>
                                <div className="feature-text"><h3>AI Coach</h3><p>Builds workouts, templates & weekly programs tailored to you</p></div>
                            </div>
                            <div className="feature-item">
                                <div className="feature-icon feature-icon-blue"><BarChart3 size={24} /></div>
                                <div className="feature-text"><h3>Session Analysis</h3><p>Every workout scored against your PRs, goals & history</p></div>
                            </div>
                            <div className="feature-item">
                                <div className="feature-icon feature-icon-purple"><Warehouse size={24} /></div>
                                <div className="feature-text"><h3>Workout Spaces</h3><p>Set up your gym so the coach only picks exercises you can do</p></div>
                            </div>
                        </div>
                        <button className="goal-save-btn button-margin-top-large" onClick={() => setStep(2)}>Next</button>
                    </div>
                )}

                {/* STEP 2: FEATURES 2 */}
                {step === 2 && (
                    <WizardShell dots={[false, true]} onBack={() => setStep(1)} title="Track & Improve" subtitle="See your progress clearly">
                        <div className="feature-list">
                            <div className="feature-item">
                                <div className="feature-icon feature-icon-amber"><CalendarCheck size={24} /></div>
                                <div className="feature-text"><h3>Weekly Reviews</h3><p>Examine how you performed for the week at a glance</p></div>
                            </div>
                            <div className="feature-item">
                                <div className="feature-icon feature-icon-red"><Zap size={24} /></div>
                                <div className="feature-text">
                                    <h3><span className="coming-soon-badge">Soon</span>BYO API Key</h3>
                                    <p>Don't pay $15/mo for another app. This should cost ~$0.50/mo. Bring your own key.</p>
                                </div>
                            </div>
                        </div>
                        <button className="goal-save-btn button-margin-top-large" onClick={() => setStep(3)}>Let's set up your profile</button>
                    </WizardShell>
                )}

                {/* STEP 3: GOAL */}
                {step === 3 && (
                    <WizardShell onBack={() => setStep(2)} title="Set Your Primary Goal" subtitle="IronAI tailors its scoring and AI Coach suggestions based on what you are trying to achieve right now.">
                        <OptionCardGrid
                            options={GOALS.map(g => ({ ...g, id: g.id! }))}
                            selected={selectedGoal}
                            onSelect={(id) => setSelectedGoal(id as UserProfile['goal'])}
                        />
                        <button className="goal-save-btn" disabled={!selectedGoal} onClick={() => setStep(4)}>Next</button>
                    </WizardShell>
                )}

                {/* STEP 4: EXPERIENCE */}
                {step === 4 && (
                    <WizardShell onBack={() => setStep(3)} title="Your Experience" subtitle="This helps the AI recommend appropriate volume and complexity.">
                        <OptionCardGrid
                            options={EXPERIENCES}
                            selected={selectedExperience ?? null}
                            onSelect={(id) => setSelectedExperience(id as UserProfile['experienceLevel'])}
                            singleCol
                        />
                        <button className="goal-save-btn button-margin-top-large" disabled={!selectedExperience} onClick={() => setStep(5)}>Next</button>
                    </WizardShell>
                )}

                {/* STEP 5: STRENGTH BASELINES */}
                {step === 5 && (
                    <StrengthBaselineStep
                        onBack={() => setStep(4)}
                        initialUnit={selectedWeightUnit}
                        initialBaselines={selectedBaselines}
                        onContinue={({ weightUnit, baselines }) => {
                            setSelectedWeightUnit(weightUnit);
                            setSelectedBaselines(baselines);
                            setIsBeginnerNoWeights(false);
                            setStep(6);
                        }}
                        onSkip={() => {
                            setIsBeginnerNoWeights(true);
                            setSelectedBaselines({});
                            setStep(6);
                        }}
                    />
                )}

                {/* STEP 6: EQUIPMENT */}
                {step === 6 && (
                    <WizardShell onBack={() => setStep(5)} title="Initial Equipment" subtitle="What equipment do you have access to? You can create more detailed profiles later.">
                        <OptionCardGrid
                            options={[...EQUIPMENTS]}
                            selected={selectedEquipment}
                            onSelect={(id) => setSelectedEquipment(id as typeof selectedEquipment)}
                            singleCol
                        />
                        <button className="goal-save-btn button-margin-top-large" disabled={!selectedEquipment} onClick={() => setStep(7)}>Next</button>
                    </WizardShell>
                )}

                {/* STEP 7: SCHEDULE */}
                {step === 7 && (
                    <WizardShell onBack={() => setStep(6)} title="Target Schedule" subtitle="How many days per week are you aiming to train?">
                        <div className="schedule-picker">
                            <CalendarDays size={48} color="var(--color-primary)" className="icon-opacity-low" />
                            <div className="schedule-buttons">
                                {SCHEDULES.map(days => (
                                    <button
                                        key={days}
                                        className={`schedule-btn ${selectedDays === days ? 'selected' : ''}`}
                                        onClick={() => setSelectedDays(days)}
                                    >
                                        {days}
                                    </button>
                                ))}
                            </div>
                            <p className="schedule-hint">Most goal-oriented programs require 3-5 days.</p>
                        </div>
                        <button className="goal-save-btn button-margin-top-large" disabled={!selectedDays} onClick={() => setStep(8)}>Next</button>
                    </WizardShell>
                )}

                {/* STEP 8: PERSONA */}
                {step === 8 && (
                    <WizardShell onBack={() => setStep(7)} title="Choose Coach Style" subtitle="How do you want your AI Coach to speak to you?">
                        <OptionCardGrid
                            options={PERSONAS}
                            selected={selectedPersona ?? null}
                            onSelect={(id) => setSelectedPersona(id as UserProfile['coachPersona'])}
                            singleCol
                        />
                        <button className="goal-save-btn button-margin-top-large" disabled={!selectedPersona} onClick={() => setStep(9)}>Next</button>
                    </WizardShell>
                )}

                {/* STEP 9: PREFERENCES */}
                {step === 9 && (
                    <WizardShell onBack={() => setStep(8)} title="Injuries & Quirks" subtitle="Are there any exercises you physically cannot do? Bad knees? Only 30 minutes to train?">
                        <div className="preferences-container preferences-container-flex">
                            <FileText size={48} color="var(--color-primary)" className="icon-opacity-low" />
                            <textarea
                                value={selectedPreferences}
                                onChange={(e) => setSelectedPreferences(e.target.value)}
                                placeholder="e.g. 'I have a bad lower back so I cannot do heavy barbell squats or deadlifts. I also prefer working out at 5am so I need to keep resting time strict.'"
                                className="textarea-styled"
                            />
                            <p className="textarea-hint">(Optional) The AI Coach will read these instructions before every response to ensure safe programming.</p>
                        </div>
                        <button className="goal-save-btn button-margin-top-large" onClick={handleSave}>Complete Setup</button>
                    </WizardShell>
                )}

            </div>
        </div>
    );
}
