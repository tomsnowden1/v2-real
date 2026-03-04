import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { Search, ChevronLeft } from 'lucide-react';
import './ExerciseLibrary.css';

export default function ExerciseLibrary() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');

    // Automatically react to Dexie database changes
    const exercises = useLiveQuery(
        () => db.exercises.where('name').startsWithIgnoreCase(searchQuery).toArray(),
        [searchQuery]
    );

    return (
        <div className="page-content library-page">
            <header className="library-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ChevronLeft size={24} />
                    <span>Back</span>
                </button>
                <h1>Exercises</h1>
                <button className="create-custom-btn">
                    Create custom exercise
                </button>
            </header>

            <div className="library-search-container">
                <div className="search-input-wrapper">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search by name or alias"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>
                <button className="filter-btn">
                    Filters <span>▼</span>
                </button>
            </div>

            <div className="library-list-container">
                <div className="library-list-header">
                    <span className="lib-title">EXERCISE LIBRARY</span>
                    <span className="lib-count">{exercises?.length || 0} total</span>
                </div>

                <div className="library-list">
                    {exercises?.map(ex => (
                        <div
                            key={ex.id}
                            className="library-item"
                            onClick={() => navigate(`/exercises/${ex.id}`)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="lib-item-info">
                                <span className="lib-item-name">{ex.name}</span>
                                <span className="lib-item-details">{ex.bodyPart} • {ex.category}</span>
                                {ex.isCustom && <span className="lib-item-badge">Custom</span>}
                            </div>
                        </div>
                    ))}
                    {exercises?.length === 0 && (
                        <div className="empty-state">No exercises found.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
