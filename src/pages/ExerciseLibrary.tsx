import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { Search, ChevronLeft } from 'lucide-react';
import './ExerciseLibrary.css';

const BODY_PARTS = ['Arms', 'Back', 'Chest', 'Core', 'Legs', 'Shoulders'];
const CATEGORIES = ['Barbell', 'Dumbbell', 'Cable', 'Bodyweight', 'Machine', 'Band', 'Other'];

export default function ExerciseLibrary() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeBodyPart, setActiveBodyPart] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [showCustomOnly, setShowCustomOnly] = useState(false);

    // Load all exercises reactively — client-side filtering handles search + filters
    const allExercises = useLiveQuery(() => db.exercises.toArray(), []);

    const exercises = useMemo(() => {
        if (!allExercises) return undefined;
        let result = allExercises;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(ex =>
                ex.name.toLowerCase().includes(q) ||
                ex.bodyPart.toLowerCase().includes(q) ||
                ex.category.toLowerCase().includes(q) ||
                (ex.aliases || []).some(a => a.toLowerCase().includes(q))
            );
        }
        if (activeBodyPart) result = result.filter(ex => ex.bodyPart === activeBodyPart);
        if (activeCategory) result = result.filter(ex => ex.category === activeCategory);
        if (showCustomOnly) result = result.filter(ex => ex.isCustom);
        return result;
    }, [allExercises, searchQuery, activeBodyPart, activeCategory, showCustomOnly]);

    const isFiltered = searchQuery.trim() || activeBodyPart || activeCategory || showCustomOnly;

    const toggleBodyPart = (bp: string) => setActiveBodyPart(prev => prev === bp ? null : bp);
    const toggleCategory = (cat: string) => setActiveCategory(prev => prev === cat ? null : cat);

    return (
        <div className="page-content library-page">
            <header className="library-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ChevronLeft size={24} />
                    <span>Back</span>
                </button>
                <h1>Exercises</h1>
                <button className="create-custom-btn">
                    + Custom
                </button>
            </header>

            <div className="library-search-container">
                <div className="search-input-wrapper">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search by name, alias, muscle, or equipment"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>

                <div className="filter-chips-section">
                    <div className="filter-chips-row">
                        {BODY_PARTS.map(bp => (
                            <button
                                key={bp}
                                className={`filter-chip${activeBodyPart === bp ? ' active' : ''}`}
                                onClick={() => toggleBodyPart(bp)}
                            >
                                {bp}
                            </button>
                        ))}
                    </div>
                    <div className="filter-chips-row">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                className={`filter-chip${activeCategory === cat ? ' active' : ''}`}
                                onClick={() => toggleCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                        <button
                            className={`filter-chip${showCustomOnly ? ' active' : ''}`}
                            onClick={() => setShowCustomOnly(prev => !prev)}
                        >
                            Custom
                        </button>
                    </div>
                </div>
            </div>

            <div className="library-list-container">
                <div className="library-list-header">
                    <span className="lib-title">EXERCISE LIBRARY</span>
                    <span className="lib-count">
                        {allExercises?.length ?? 0} total
                        {isFiltered && exercises !== undefined && exercises.length !== allExercises?.length
                            ? ` • ${exercises.length} shown`
                            : ''}
                    </span>
                </div>

                <div className="library-list">
                    {exercises?.map(ex => (
                        <div
                            key={ex.id}
                            className="library-item"
                            onClick={() => navigate(`/exercises/${ex.id}`)}
                        >
                            <div className="lib-item-info">
                                <span className="lib-item-name">{ex.name}</span>
                                <span className="lib-item-details">{ex.bodyPart} • {ex.category}</span>
                                {ex.isCustom && <span className="lib-item-badge">Custom</span>}
                            </div>
                        </div>
                    ))}
                    {exercises?.length === 0 && (
                        <div className="empty-state">No exercises match your search or filters.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
