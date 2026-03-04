import { useState } from 'react';
import { assignTemplateToDay } from '../db/weeklyPlanService';
import { X, Zap, ChevronDown, Check } from 'lucide-react';
import type { WeeklyPlan } from '../db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import './AdjustWeekModal.css';

interface Props {
    currentPlan: WeeklyPlan;
    onClose: () => void;
}

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function AdjustWeekModal({ currentPlan, onClose }: Props) {
    const defaultAssignments = Array(7).fill({ templateId: null });
    const initialAssignments = currentPlan.dayAssignments && currentPlan.dayAssignments.length === 7
        ? currentPlan.dayAssignments
        : defaultAssignments;

    const [assignments, setAssignments] = useState(initialAssignments);
    const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null);

    const templates = useLiveQuery(() => db.templates.toArray());

    const handleSave = async () => {
        // Save each day's assignment
        for (let i = 0; i < 7; i++) {
            await assignTemplateToDay(i, assignments[i].templateId);
        }
        onClose();
    };

    const handleSelectTemplate = (dayIdx: number, templateId: string | null) => {
        const newAssignments = [...assignments];
        newAssignments[dayIdx] = { ...newAssignments[dayIdx], templateId };
        setAssignments(newAssignments);
        setOpenDropdownIdx(null);
    };

    const scheduledCount = assignments.filter(a => a.templateId !== null).length;

    return (
        <div className="adjust-modal-overlay" onClick={onClose}>
            <div className="adjust-modal-content" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <header className="adjust-header">
                    <h2>Weekly Setup</h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </header>

                <div className="adjust-body" style={{ overflowY: 'auto', flex: 1, padding: '0 24px', position: 'relative' }}>

                    <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '24px' }}>
                        Assign workouts to specific days. Tap a day to change its plan.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '120px' }}>
                        {DAY_LABELS.map((dayLabel, idx) => {
                            const assignment = assignments[idx];
                            const template = assignment.templateId && templates
                                ? templates.find(t => t.id === assignment.templateId)
                                : null;

                            const isDropdownOpen = openDropdownIdx === idx;

                            return (
                                <div key={idx} style={{ position: 'relative' }}>
                                    <div
                                        onClick={() => setOpenDropdownIdx(isDropdownOpen ? null : idx)}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '16px',
                                            backgroundColor: 'var(--color-surface)',
                                            border: isDropdownOpen ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            boxShadow: isDropdownOpen ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                                        }}
                                    >
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{dayLabel}</span>
                                            <span style={{ fontSize: '15px', fontWeight: 500, color: template ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}>
                                                {template ? template.name : 'Rest Day'}
                                            </span>
                                        </div>
                                        <ChevronDown size={20} color="var(--color-text-muted)" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                    </div>

                                    {isDropdownOpen && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            marginTop: '8px',
                                            backgroundColor: 'var(--color-surface)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: '12px',
                                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                            zIndex: 10,
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            padding: '8px'
                                        }}>
                                            <div
                                                onClick={() => handleSelectTemplate(idx, null)}
                                                style={{ padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: assignment.templateId === null ? 'var(--color-bg)' : 'transparent' }}
                                            >
                                                <span style={{ color: 'var(--color-text-main)' }}>Rest Day</span>
                                                {assignment.templateId === null && <Check size={16} color="var(--color-primary)" />}
                                            </div>

                                            {templates && templates.length > 0 && <div style={{ height: '1px', backgroundColor: 'var(--color-border)', margin: '8px 0' }} />}

                                            {templates?.map(t => (
                                                <div
                                                    key={t.id}
                                                    onClick={() => handleSelectTemplate(idx, t.id)}
                                                    style={{ padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: assignment.templateId === t.id ? 'var(--color-bg)' : 'transparent' }}
                                                >
                                                    <span style={{ color: 'var(--color-text-main)' }}>{t.name}</span>
                                                    {assignment.templateId === t.id && <Check size={16} color="var(--color-primary)" />}
                                                </div>
                                            ))}

                                            {(!templates || templates.length === 0) && (
                                                <div style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontSize: '13px', fontStyle: 'italic', textAlign: 'center' }}>
                                                    No templates saved yet.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                </div>

                <div className="adjust-footer" style={{ marginTop: 'auto', backgroundColor: 'var(--color-surface)', zIndex: 5, borderTop: '1px solid var(--color-border)' }}>
                    <button className="primary-save-btn" onClick={handleSave}>
                        <Zap size={18} fill="currentColor" />
                        <span>Lock it in ({scheduledCount} days)</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
