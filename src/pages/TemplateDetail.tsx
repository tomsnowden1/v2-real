import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type WorkoutExercise } from '../db/database';
import { useWorkout } from '../context/WorkoutContext';
import { ChevronLeft, Play, Plus, Trash2 } from 'lucide-react';
import ExerciseCard from '../components/ExerciseCard';
import ReplaceModal from '../components/ReplaceModal';
import ConfirmModal from '../components/ConfirmModal';
import { deleteTemplate } from '../db/templateService';
import { findOrCreateExerciseByName } from '../db/exerciseService';
import { generateId } from '../lib/id';

export default function TemplateDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { startWorkout, updateExercises, isActive } = useWorkout();

    // LiveQuery to fetch template
    const template = useLiveQuery(() => id ? db.templates.get(id) : undefined, [id]);

    const [name, setName] = useState('');

    // local state for models
    const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
    const [exerciseToReplace, setExerciseToReplace] = useState<string | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Sync local name with db when loaded
    useEffect(() => {
        if (template && !name) {
            setName(template.name);
        }
    }, [template, name]);

    if (template === undefined) {
        return <div className="page-content" style={{ padding: 20 }}>Loading...</div>;
    }

    if (template === null) {
        return <div className="page-content" style={{ padding: 20 }}>Template not found</div>;
    }

    // Save changes to db
    const saveChanges = async (updates: Partial<import('../db/database').Template>) => {
        if (id) {
            await db.templates.update(id, updates);
        }
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setName(e.target.value);
    };

    const handleNameBlur = () => {
        if (name !== template.name && name.trim().length > 0) {
            saveChanges({ name: name.trim() });
        } else if (name.trim().length === 0) {
            setName(template.name); // revert if empty
        }
    };

    const handleStartWorkout = () => {
        if (isActive) {
            const confirmReplace = window.confirm("You have an active workout. Replace it?");
            if (!confirmReplace) return;
        }

        startWorkout(template.name, template.id);
        const freshExercises = template.exercises.map(ex => ({
            ...ex,
            id: `we-${generateId()}`,
            sets: ex.sets.map(s => ({ ...s, isDone: false }))
        }));
        updateExercises(freshExercises);
        navigate('/workout');
    };

    const handleDeleteTemplate = async () => {
        setIsDeleteModalOpen(false);
        if (id) {
            await deleteTemplate(id);
            navigate('/templates', { replace: true });
        }
    };

    const handleMoveUp = (index: number) => {
        if (index === 0) return;
        const newExs = [...template.exercises];
        [newExs[index - 1], newExs[index]] = [newExs[index], newExs[index - 1]];
        saveChanges({ exercises: newExs });
    };

    const handleMoveDown = (index: number) => {
        if (index === template.exercises.length - 1) return;
        const newExs = [...template.exercises];
        [newExs[index], newExs[index + 1]] = [newExs[index + 1], newExs[index]];
        saveChanges({ exercises: newExs });
    };

    const handleSetsChange = (index: number, newSets: import('../db/database').SetRecord[]) => {
        const newExs = [...template.exercises];
        newExs[index] = { ...newExs[index], sets: newSets };
        saveChanges({ exercises: newExs });
    };

    const openReplaceModal = (exerciseId: string | null) => {
        setExerciseToReplace(exerciseId);
        setIsReplaceModalOpen(true);
    };

    const handleReplace = async (newName: string) => {
        setIsReplaceModalOpen(false);
        const dbEx = await findOrCreateExerciseByName(newName);

        if (exerciseToReplace) {
            const newExs = template.exercises.map(ex =>
                ex.id === exerciseToReplace ? { ...ex, exerciseId: dbEx.id, exerciseName: dbEx.name } : ex
            );
            saveChanges({ exercises: newExs });
        } else {
            const newEx: WorkoutExercise = {
                id: `we-${generateId()}`,
                exerciseId: dbEx.id,
                exerciseName: dbEx.name,
                sets: [{ id: `s-${generateId()}`, type: 'normal', weight: 0, reps: 0, isDone: false }]
            };
            saveChanges({ exercises: [...template.exercises, newEx] });
        }
        setExerciseToReplace(null);
    };

    const handleDeleteExercise = (exerciseId: string) => {
        const newExs = template.exercises.filter(ex => ex.id !== exerciseId);
        saveChanges({ exercises: newExs });
    };

    return (
        <div className="page-content" style={{ padding: '16px', paddingBottom: '100px' }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <button
                        onClick={() => navigate(-1)}
                        style={{ background: 'none', border: 'none', color: 'var(--color-text-main)', cursor: 'pointer', padding: '8px', marginLeft: '-8px', display: 'flex', alignItems: 'center' }}
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <input
                        type="text"
                        value={name}
                        onChange={handleNameChange}
                        onBlur={handleNameBlur}
                        style={{
                            fontSize: '20px',
                            fontWeight: 700,
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--color-text-main)',
                            outline: 'none',
                            width: '100%',
                            marginLeft: '8px'
                        }}
                    />
                </div>
                <button
                    onClick={handleStartWorkout}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'var(--color-primary-light, rgba(59, 130, 246, 0.1))',
                        color: 'var(--color-primary)',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '14px'
                    }}
                >
                    <Play size={16} fill="currentColor" />
                    Start
                </button>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {template.exercises.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                        No exercises in this template.
                    </div>
                ) : (
                    template.exercises.map((ex, idx) => {
                        const mappedSets = ex.sets.map(s => ({
                            ...s,
                            weight: s.weight.toString(),
                            reps: s.reps.toString()
                        }));

                        return (
                            <ExerciseCard
                                key={ex.id}
                                name={ex.exerciseName || ex.exerciseId}
                                exerciseId={ex.exerciseId}
                                initialSets={mappedSets}
                                onSwapClick={() => openReplaceModal(ex.id)}
                                onMoveUp={idx > 0 ? () => handleMoveUp(idx) : undefined}
                                onMoveDown={idx < template.exercises.length - 1 ? () => handleMoveDown(idx) : undefined}
                                onRemoveClick={() => handleDeleteExercise(ex.id)}
                                onSetsChange={(newSets) => {
                                    const contextSets = newSets.map(s => ({
                                        ...s,
                                        weight: Number(s.weight) || 0,
                                        reps: Number(s.reps) || 0
                                    }));
                                    handleSetsChange(idx, contextSets);
                                }}
                            />
                        );
                    })
                )}

                <button
                    onClick={() => openReplaceModal(null)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '16px',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text-main)',
                        border: '1px dashed var(--color-border)',
                        borderRadius: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginTop: '8px'
                    }}
                >
                    <Plus size={20} />
                    Add Exercise
                </button>
            </div>

            <div style={{ marginTop: '40px' }}>
                <button
                    onClick={() => setIsDeleteModalOpen(true)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '16px',
                        width: '100%',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    <Trash2 size={20} />
                    Delete Template
                </button>
            </div>

            <ReplaceModal
                isOpen={isReplaceModalOpen}
                isAdd={!exerciseToReplace}
                onClose={() => setIsReplaceModalOpen(false)}
                onReplace={handleReplace}
            />

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                title="Delete Template?"
                message="Are you sure you want to delete this template? This cannot be undone."
                confirmText="Yes, Delete"
                isDestructive={true}
                onConfirm={handleDeleteTemplate}
                onCancel={() => setIsDeleteModalOpen(false)}
            />
        </div>
    );
}
