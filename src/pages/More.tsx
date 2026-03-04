import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getUserProfile, saveUserProfile } from '../db/userProfileService';
import type { UserProfile } from '../db/database';
import { Trophy } from 'lucide-react';

export default function More() {
    const profile = useLiveQuery(() => getUserProfile().then(p => p || null));

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

    return (
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

            </div>
        </div>
    );
}
