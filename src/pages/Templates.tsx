import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { useWorkout } from '../context/WorkoutContext';
import { generateId } from '../lib/id';
import { Bookmark, ChevronLeft, Play } from 'lucide-react';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import './Templates.css';

export default function Templates() {
    const navigate = useNavigate();
    const { startWorkout, updateExercises, isActive } = useWorkout();
    const templates = useLiveQuery(() => db.templates.toArray());

    const handleStartWorkout = (e: React.MouseEvent, template: import('../db/database').Template) => {
        e.stopPropagation();

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

    if (templates === undefined) {
        return <Spinner label="Loading templates..." />;
    }

    return (
        <div className="page-content templates-page">
            <header className="templates-header">
                <button
                    onClick={() => navigate(-1)}
                    className="templates-back-btn"
                    aria-label="Go back"
                >
                    <ChevronLeft size={24} />
                </button>
                <h1 className="templates-title">Templates</h1>
            </header>

            {templates.length === 0 ? (
                <EmptyState
                    icon={<Bookmark size={48} />}
                    title="No templates yet"
                    description='Build a workout and tap "Save as Template" to add one here.'
                />
            ) : (
                <div className="templates-list">
                    {templates.map(template => {
                        const lastPerformedDate = template.lastPerformed
                            ? new Date(template.lastPerformed).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                            : 'Never';

                        return (
                            <div
                                key={template.id}
                                className="card template-card"
                                onClick={() => navigate(`/templates/${template.id}`)}
                            >
                                <div className="template-card-info">
                                    <h3 className="template-card-name">{template.name}</h3>
                                    <p className="template-card-meta">
                                        {template.exercises.length} exercises • Last: {lastPerformedDate}
                                    </p>
                                </div>
                                <button
                                    className="template-start-btn"
                                    onClick={(e) => handleStartWorkout(e, template)}
                                >
                                    <Play size={16} fill="currentColor" />
                                    Start
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
