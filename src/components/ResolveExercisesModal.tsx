import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import type { Exercise } from '../db/database';
import type { ResolutionResult } from '../lib/exerciseResolver';
import './ResolveExercisesModal.css';

export interface ResolvedChoice {
    rawName: string;
    exerciseId: string | 'CUSTOM';
    shouldRemember: boolean;
}

interface Props {
    unresolvedItems: ResolutionResult[];
    allExercises: Exercise[];
    onComplete: (choices: ResolvedChoice[]) => void;
    onCancel: () => void;
}

export default function ResolveExercisesModal({ unresolvedItems, allExercises, onComplete, onCancel }: Props) {
    const [choices, setChoices] = useState<Record<string, { id: string, remember: boolean }>>({});
    const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});

    const handleSelect = (rawName: string, id: string) => {
        setChoices(prev => ({
            ...prev,
            [rawName]: { id, remember: prev[rawName]?.remember ?? true }
        }));
    };

    const handleToggleRemember = (rawName: string) => {
        setChoices(prev => {
            const current = prev[rawName];
            if (!current) return prev;
            return {
                ...prev,
                [rawName]: { ...current, remember: !current.remember }
            };
        });
    };

    const handleSearchChange = (rawName: string, q: string) => {
        setSearchQueries(prev => ({ ...prev, [rawName]: q }));
    };

    const isAllResolved = unresolvedItems.every(item => choices[item.rawName]);

    const submit = () => {
        if (!isAllResolved) return;
        const result: ResolvedChoice[] = unresolvedItems.map(item => ({
            rawName: item.rawName,
            exerciseId: choices[item.rawName].id,
            shouldRemember: choices[item.rawName].remember
        }));
        onComplete(result);
    };

    return (
        <div className="resolve-modal-overlay">
            <div className="resolve-modal-content card">
                <header className="resolve-header">
                    <div className="resolve-title">
                        <AlertCircle size={20} className="icon-warning" />
                        <h2>Resolve {unresolvedItems.length} {unresolvedItems.length === 1 ? 'Exercise' : 'Exercises'}</h2>
                    </div>
                    <button className="icon-btn" onClick={onCancel}><X size={20} /></button>
                </header>
                <div className="resolve-body">
                    <p className="resolve-desc">
                        Coach suggested some exercises that don't cleanly match your library. Please select the correct match below to prevent duplicates.
                    </p>

                    {unresolvedItems.map(item => {
                        const query = searchQueries[item.rawName] || '';
                        const searchResults = query.length > 1
                            ? allExercises.filter(ex => ex.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
                            : [];

                        const currentChoiceId = choices[item.rawName]?.id;
                        const currentChoiceRemember = choices[item.rawName]?.remember;

                        return (
                            <div key={item.rawName} className="resolve-block">
                                <h3>"{item.rawName}"</h3>

                                <div className="resolve-options">
                                    {(item.candidates || []).map(cand => (
                                        <label key={cand.id} className={`resolve-option ${currentChoiceId === cand.id ? 'selected' : ''}`}>
                                            <input
                                                type="radio"
                                                name={`cand-${item.rawName}`}
                                                checked={currentChoiceId === cand.id}
                                                onChange={() => handleSelect(item.rawName, cand.id)}
                                            />
                                            <div className="option-text">
                                                <span className="option-name">{cand.name}</span>
                                                <span className="option-meta">{cand.category} • {cand.bodyPart}</span>
                                            </div>
                                        </label>
                                    ))}

                                    <div className="resolve-search-box">
                                        <input
                                            type="text"
                                            placeholder="Search other exercises..."
                                            value={query}
                                            onChange={e => handleSearchChange(item.rawName, e.target.value)}
                                            className="search-input"
                                        />
                                        {searchResults.length > 0 && (
                                            <div className="search-results">
                                                {searchResults.map(res => (
                                                    <label key={res.id} className={`resolve-option ${currentChoiceId === res.id ? 'selected' : ''}`}>
                                                        <input
                                                            type="radio"
                                                            name={`cand-${item.rawName}`}
                                                            checked={currentChoiceId === res.id}
                                                            onChange={() => handleSelect(item.rawName, res.id)}
                                                        />
                                                        <span className="option-name">{res.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <label className={`resolve-option ${currentChoiceId === 'CUSTOM' ? 'selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name={`cand-${item.rawName}`}
                                            checked={currentChoiceId === 'CUSTOM'}
                                            onChange={() => handleSelect(item.rawName, 'CUSTOM')}
                                        />
                                        <span className="option-name" style={{ fontStyle: 'italic' }}>Create new custom exercise "{item.rawName}"...</span>
                                    </label>
                                </div>

                                {currentChoiceId && currentChoiceId !== 'CUSTOM' && (
                                    <label className="remember-toggle">
                                        <input
                                            type="checkbox"
                                            checked={currentChoiceRemember}
                                            onChange={() => handleToggleRemember(item.rawName)}
                                        />
                                        Remember this choice next time
                                    </label>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="resolve-footer">
                    <button className="secondary-btn" onClick={onCancel}>Cancel</button>
                    <button className="primary-btn" disabled={!isAllResolved} onClick={submit}>
                        Confirm & Continue
                    </button>
                </div>
            </div>
        </div>
    );
}
