import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getUserProfile, saveUserProfile } from '../db/userProfileService';
import { db } from '../db/database';
import type { UserProfile } from '../db/database';
import { Trophy, TrendingUp } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

export default function More() {
    const profile = useLiveQuery(() => getUserProfile().then(p => p || null));
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<string | null>(null);

    const handleExportJSON = async () => {
        const history = await db.workoutHistory.toArray();
        const templates = await db.templates.toArray();
        const userProfileData = await getUserProfile();
        const data = {
            version: 1,
            exportedAt: new Date().toISOString(),
            workoutHistory: history,
            templates,
            profile: userProfileData,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ironlog-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportCSV = async () => {
        const history = await db.workoutHistory.orderBy('startTime').reverse().toArray();
        const rows: string[] = ['Date,Workout,Duration (min),Exercise,Set,Weight,Reps'];
        for (const workout of history) {
            const date = new Date(workout.startTime).toLocaleDateString();
            const name = `"${workout.name.replace(/"/g, '""')}"`;
            const duration = Math.round((workout.durationMs || 0) / 60000);
            for (const ex of workout.exercises || []) {
                const exName = `"${(ex.exerciseName || ex.exerciseId).replace(/"/g, '""')}"`;
                ex.sets.forEach((set, idx) => {
                    rows.push(`${date},${name},${duration},${exName},${idx + 1},${set.weight ?? ''},${set.reps ?? ''}`);
                });
            }
        }
        const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ironlog-history-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsImporting(true);
        setImportResult(null);
        try {
            const text = await file.text();
            const data = JSON.parse(text) as { workoutHistory?: unknown[]; templates?: unknown[] };
            if (!data.workoutHistory || !Array.isArray(data.workoutHistory)) {
                setImportResult('Invalid file — expected an IronLog backup JSON.');
                return;
            }
            await db.workoutHistory.bulkPut(data.workoutHistory as Parameters<typeof db.workoutHistory.bulkPut>[0]);
            if (data.templates && Array.isArray(data.templates)) {
                await db.templates.bulkPut(data.templates as Parameters<typeof db.templates.bulkPut>[0]);
            }
            setImportResult(`Imported ${data.workoutHistory.length} workouts successfully.`);
        } catch {
            setImportResult('Import failed. Make sure the file is a valid IronLog backup.');
        } finally {
            setIsImporting(false);
            e.target.value = '';
        }
    };

    const handleReset = async () => {
        // Clear all user data from the database (keep exercises — those are the built-in library)
        await Promise.all([
            db.workoutHistory.clear(),
            db.prs.clear(),
            db.gymProfiles.clear(),
            db.userProfiles.clear(),
            db.weeklyPlans.clear(),
            db.templates.clear(),
            db.chatMessages.clear(),
            db.restTimerPrefs.clear(),
            db.takeaways.clear(),
        ]);
        // Clear session/ephemeral localStorage keys
        localStorage.removeItem('ironai_active_workout');
        localStorage.removeItem('ironai_install_banner_dismissed');
        // Hard reload — the app will show the onboarding wizard with no profile
        window.location.href = '/';
    };

    const handleReviewPreferenceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (!profile) return;
        const value = e.target.value as UserProfile['postWorkoutReview'];
        await saveUserProfile({ ...profile, postWorkoutReview: value });
    };

    const handleThemeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (!profile) return;
        const value = e.target.value as UserProfile['theme'];
        await saveUserProfile({ ...profile, theme: value });
    };

    const handleWeightUnitChange = async (unit: 'lbs' | 'kg') => {
        if (!profile) return;
        await saveUserProfile({ ...profile, weightUnit: unit });
    };

    const handleSuggestionUIChange = async (mode: UserProfile['weightSuggestionUI']) => {
        if (!profile) return;
        await saveUserProfile({ ...profile, weightSuggestionUI: mode });
    };

    const suggestionUI = profile?.weightSuggestionUI ?? 'autofill';
    const weightUnit = profile?.weightUnit ?? 'lbs';

    return (
        <>
        <div className="page-content" style={{ padding: '16px' }}>
            <h1>More</h1>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '16px' }}>Library tools, gyms, and preferences.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                <section>
                    <h2 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>Training</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <Link to="/exercises" style={{ textDecoration: 'none' }}>
                            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer' }}>
                                <h3 style={{ margin: 0, color: 'var(--color-text-main)', fontSize: '16px' }}>Exercise library</h3>
                                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>Browse exercises, history, and training details.</p>
                            </div>
                        </Link>

                        <Link to="/templates" style={{ textDecoration: 'none' }}>
                            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer' }}>
                                <h3 style={{ margin: 0, color: 'var(--color-text-main)', fontSize: '16px' }}>Templates</h3>
                                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>Manage your saved workout routines.</p>
                            </div>
                        </Link>

                        <Link to="/gyms" style={{ textDecoration: 'none' }}>
                            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer' }}>
                                <h3 style={{ margin: 0, color: 'var(--color-text-main)', fontSize: '16px' }}>Gyms</h3>
                                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>Manage workout spaces, equipment, and templates.</p>
                            </div>
                        </Link>

                        <Link to="/records" style={{ textDecoration: 'none' }}>
                            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Trophy size={20} color="var(--color-accent)" />
                                    <h3 style={{ margin: 0, color: 'var(--color-text-main)', fontSize: '16px' }}>Personal Records</h3>
                                </div>
                                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>View your all-time best performances.</p>
                            </div>
                        </Link>

                        <Link to="/analytics" style={{ textDecoration: 'none' }}>
                            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <TrendingUp size={20} color="var(--color-primary)" />
                                    <h3 style={{ margin: 0, color: 'var(--color-text-main)', fontSize: '16px' }}>Analytics</h3>
                                </div>
                                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>Volume trends, workout frequency, and top exercises.</p>
                            </div>
                        </Link>
                    </div>
                </section>

                <section>
                    <h2 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>Account & Settings</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <Link to="/settings" style={{ textDecoration: 'none' }}>
                            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer' }}>
                                <h3 style={{ margin: 0, color: 'var(--color-text-main)', fontSize: '16px' }}>AI Provider Settings</h3>
                                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>Manage API keys, select models, and set local budget caps.</p>
                            </div>
                        </Link>
                    </div>
                </section>

                <section>
                    <h2 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>AI Preferences</h2>
                    <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, color: 'var(--color-text-main)', fontSize: '15px' }}>Post-Workout Review</h3>
                                <p style={{ margin: 0, marginTop: '4px', fontSize: '12px', color: 'var(--color-text-muted)', maxWidth: '200px' }}>
                                    How much detail the AI Coach provides after a session.
                                </p>
                            </div>
                            <select
                                value={profile?.postWorkoutReview || 'Brief'}
                                onChange={handleReviewPreferenceChange}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--color-border)',
                                    backgroundColor: 'var(--color-bg)',
                                    color: 'var(--color-text-main)',
                                    fontSize: '14px',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="None">None</option>
                                <option value="Brief">Brief</option>
                                <option value="Extended">Extended</option>
                            </select>
                        </div>

                    </div>
                </section>

                <section>
                    <h2 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>Workout Display</h2>
                    <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* Weight unit */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, color: 'var(--color-text-main)', fontSize: '15px' }}>Weight Unit</h3>
                                <p style={{ margin: 0, marginTop: '4px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                                    Your preferred unit for logging weights.
                                </p>
                            </div>
                            <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                                {(['lbs', 'kg'] as const).map(u => (
                                    <button
                                        key={u}
                                        onClick={() => handleWeightUnitChange(u)}
                                        style={{
                                            padding: '8px 16px',
                                            border: 'none',
                                            background: weightUnit === u ? 'var(--color-primary)' : 'var(--color-bg)',
                                            color: weightUnit === u ? 'white' : 'var(--color-text-muted)',
                                            fontWeight: 600,
                                            fontSize: '14px',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s, color 0.2s',
                                        }}
                                    >
                                        {u}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                            <h3 style={{ margin: '0 0 4px', color: 'var(--color-text-main)', fontSize: '15px' }}>Suggestion Display</h3>
                            <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                                How AI weight suggestions appear in the workout logger.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {([
                                    { value: 'autofill', label: 'Auto-fill', desc: 'Pre-fills the weight & reps input with the suggested values.' },
                                    { value: 'placeholder', label: 'Ghost Placeholder', desc: 'Shows the suggestion as faint placeholder text — input stays empty.' },
                                    { value: 'badge', label: 'Target Badge', desc: 'Shows a small "🎯 Target" label; the input is always blank.' },
                                ] as { value: NonNullable<UserProfile['weightSuggestionUI']>; label: string; desc: string }[]).map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => handleSuggestionUIChange(opt.value)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '12px 14px',
                                            borderRadius: '10px',
                                            border: `2px solid ${suggestionUI === opt.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                            background: suggestionUI === opt.value ? 'color-mix(in srgb, var(--color-primary) 8%, var(--color-surface))' : 'var(--color-surface)',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'border-color 0.2s, background 0.2s',
                                        }}
                                    >
                                        <div style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '50%',
                                            border: `2px solid ${suggestionUI === opt.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            {suggestionUI === opt.value && (
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)' }} />
                                            )}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-main)' }}>{opt.label}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{opt.desc}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                    </div>
                </section>

                <section>
                    <h2 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>Appearance</h2>
                    <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, color: 'var(--color-text-main)', fontSize: '15px' }}>Theme</h3>
                                <p style={{ margin: 0, marginTop: '4px', fontSize: '12px', color: 'var(--color-text-muted)', maxWidth: '200px' }}>
                                    Match system preferences, light mode, or dark mode.
                                </p>
                            </div>
                            <select
                                value={profile?.theme || 'System'}
                                onChange={handleThemeChange}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--color-border)',
                                    backgroundColor: 'var(--color-bg)',
                                    color: 'var(--color-text-main)',
                                    fontSize: '14px',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="System">System</option>
                                <option value="Light">Light</option>
                                <option value="Dark">Dark</option>
                            </select>
                        </div>

                    </div>
                </section>

                <section>
                    <h2 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>Data</h2>
                    <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: 'var(--color-text-main)' }}>Export</h3>
                            <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                                Download your data as a backup or spreadsheet.
                            </p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={handleExportJSON}
                                    style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-main)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Backup (JSON)
                                </button>
                                <button
                                    onClick={handleExportCSV}
                                    style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-main)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Spreadsheet (CSV)
                                </button>
                            </div>
                        </div>
                        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                            <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: 'var(--color-text-main)' }}>Import</h3>
                            <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                                Restore workouts and templates from a JSON backup.
                            </p>
                            <label
                                style={{
                                    display: 'inline-block',
                                    padding: '9px 16px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-bg)',
                                    color: isImporting ? 'var(--color-text-muted)' : 'var(--color-text-main)',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: isImporting ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {isImporting ? 'Importing…' : 'Import Backup'}
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleImportJSON}
                                    disabled={isImporting}
                                    style={{ display: 'none' }}
                                    aria-label="Import backup JSON file"
                                />
                            </label>
                            {importResult && (
                                <p style={{ margin: '10px 0 0', fontSize: '12px', color: importResult.includes('success') ? 'var(--color-primary)' : '#ef4444' }}>
                                    {importResult}
                                </p>
                            )}
                        </div>
                    </div>
                </section>

                <section>
                    <h2 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>Danger Zone</h2>
                    <div className="card" style={{ padding: '16px' }}>
                        <h3 style={{ margin: '0 0 4px', color: 'var(--color-text-main)', fontSize: '15px' }}>Reset & Start Over</h3>
                        <p style={{ margin: '0 0 14px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            Clears all your workouts, history, coach chat, templates, and profile. Walks you through setup from the beginning. Your AI keys are kept.
                        </p>
                        <button
                            onClick={() => setShowResetConfirm(true)}
                            style={{
                                padding: '10px 18px',
                                borderRadius: '8px',
                                border: '1.5px solid #ef4444',
                                background: 'transparent',
                                color: '#ef4444',
                                fontWeight: 600,
                                fontSize: '14px',
                                cursor: 'pointer',
                            }}
                        >
                            Reset App
                        </button>
                    </div>
                </section>

            </div>
        </div>

        <ConfirmModal
            isOpen={showResetConfirm}
            title="Reset everything?"
            message="This will permanently delete all your workouts, history, coach chat, templates, and profile. You'll go through setup again. This cannot be undone."
            confirmText="Yes, reset everything"
            cancelText="Cancel"
            isDestructive
            onConfirm={handleReset}
            onCancel={() => setShowResetConfirm(false)}
        />
        </>
    );
}
