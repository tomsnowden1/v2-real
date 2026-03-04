import { useState, useEffect, useMemo } from 'react';
import { X, Search, ChevronDown } from 'lucide-react';
import { getAllExercises } from '../db/exerciseService';
import { type Exercise } from '../db/database';
import './ReplaceModal.css';

interface ReplaceModalProps {
    isOpen: boolean;
    isAdd?: boolean;
    onClose: () => void;
    onReplace: (newExerciseName: string) => void;
}

export default function ReplaceModal({ isOpen, isAdd, onClose, onReplace }: ReplaceModalProps) {
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMuscle, setSelectedMuscle] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setIsLoading(true);
        getAllExercises()
            .then(exs => {
                // Sort alphabetically
                exs.sort((a, b) => a.name.localeCompare(b.name));
                setExercises(exs);
            })
            .finally(() => setIsLoading(false));
        // Reset filters when opening
        setSearchQuery('');
        setSelectedMuscle('');
        setSelectedCategory('');
    }, [isOpen]);

    // Derive unique muscle groups and categories from loaded exercises
    const muscleGroups = useMemo(() => {
        const groups = new Set<string>();
        exercises.forEach(ex => {
            if (ex.bodyPart) groups.add(ex.bodyPart);
        });
        return Array.from(groups).sort();
    }, [exercises]);

    const categories = useMemo(() => {
        const cats = new Set<string>();
        exercises.forEach(ex => {
            if (ex.category) cats.add(ex.category);
        });
        return Array.from(cats).sort();
    }, [exercises]);

    // Filter exercises based on search + filters
    const filteredExercises = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return exercises.filter(ex => {
            const matchesSearch = !q || ex.name.toLowerCase().includes(q);
            const matchesMuscle = !selectedMuscle || ex.bodyPart === selectedMuscle;
            const matchesCategory = !selectedCategory || ex.category === selectedCategory;
            return matchesSearch && matchesMuscle && matchesCategory;
        });
    }, [exercises, searchQuery, selectedMuscle, selectedCategory]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{isAdd ? 'Add Exercise' : 'Replace Exercise'}</h3>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Search bar */}
                <div className="modal-search-bar">
                    <Search size={16} className="modal-search-icon" />
                    <input
                        type="text"
                        className="modal-search-input"
                        placeholder="Search exercises..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                </div>

                {/* Filter row */}
                <div className="modal-filters">
                    <div className="modal-filter-select-wrapper">
                        <select
                            className="modal-filter-select"
                            value={selectedMuscle}
                            onChange={e => setSelectedMuscle(e.target.value)}
                        >
                            <option value="">All Muscle Groups</option>
                            {muscleGroups.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="modal-filter-chevron" />
                    </div>
                    <div className="modal-filter-select-wrapper">
                        <select
                            className="modal-filter-select"
                            value={selectedCategory}
                            onChange={e => setSelectedCategory(e.target.value)}
                        >
                            <option value="">All Equipment</option>
                            {categories.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="modal-filter-chevron" />
                    </div>
                </div>

                <div className="modal-body">
                    {isLoading ? (
                        <p className="modal-desc" style={{ textAlign: 'center', padding: '24px' }}>Loading exercises…</p>
                    ) : filteredExercises.length === 0 ? (
                        <p className="modal-desc" style={{ textAlign: 'center', padding: '24px' }}>No exercises found.</p>
                    ) : (
                        <div className="exercise-list">
                            {filteredExercises.map(ex => (
                                <button
                                    key={ex.id}
                                    className="exercise-list-item"
                                    onClick={() => onReplace(ex.name)}
                                >
                                    <span className="exercise-list-name">{ex.name}</span>
                                    <span className="exercise-list-meta">
                                        {[ex.bodyPart, ex.category].filter(Boolean).join(' · ')}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
