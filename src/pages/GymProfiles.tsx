import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { addGym, deleteGym } from '../db/gymService';
import { generateId } from '../lib/id';
import { Plus, Trash2, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './GymProfiles.css';

export default function GymProfiles() {
    const navigate = useNavigate();
    const gyms = useLiveQuery(() => db.gymProfiles.toArray());
    const [isCreating, setIsCreating] = useState(false);
    const [newGymName, setNewGymName] = useState('');

    const handleCreateGym = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGymName.trim()) return;

        await addGym({
            id: generateId(),
            name: newGymName.trim(),
            availableEquipmentIds: [],
            customEquipment: [],
        });

        setNewGymName('');
        setIsCreating(false);
    };

    return (
        <div className="page-content gym-page">
            <header className="gym-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ChevronLeft size={24} />
                    <span>Back</span>
                </button>
                <h1>Gyms</h1>
                <button
                    className="create-btn"
                    onClick={() => setIsCreating(true)}
                >
                    <Plus size={20} />
                </button>
            </header>

            <div className="gym-content">
                <p className="gym-desc">
                    Manage your workout locations. Select available equipment for each gym so the Coach knows what you can use.
                </p>

                {isCreating && (
                    <form className="create-form card" onSubmit={handleCreateGym}>
                        <input
                            type="text"
                            placeholder="Gym Name (e.g., Park Gym)"
                            value={newGymName}
                            onChange={(e) => setNewGymName(e.target.value)}
                            className="gym-input"
                            autoFocus
                        />
                        <div className="form-actions">
                            <button
                                type="button"
                                className="cancel-btn"
                                onClick={() => setIsCreating(false)}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="save-btn">
                                Save
                            </button>
                        </div>
                    </form>
                )}

                <div className="gym-list">
                    {gyms?.map(gym => (
                        <div key={gym.id} className="gym-card card">
                            <div className="gym-card-left">
                                <div className="gym-icon-wrapper">
                                    <MapPin size={24} className="gym-icon" />
                                </div>
                                <div className="gym-info">
                                    <h3 className="gym-name">{gym.name}</h3>
                                    <span className="gym-equip-count">
                                        {gym.availableEquipmentIds.length} items available
                                    </span>
                                </div>
                            </div>
                            <div className="gym-card-right">
                                <button
                                    className="icon-btn delete-btn"
                                    onClick={() => deleteGym(gym.id)}
                                    aria-label="Delete gym"
                                >
                                    <Trash2 size={18} />
                                </button>
                                <button
                                    className="icon-btn nav-btn"
                                    onClick={() => navigate(`/gyms/${gym.id}`)}
                                    aria-label="Edit equipment"
                                >
                                    <ChevronRight size={24} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {gyms?.length === 0 && !isCreating && (
                        <div className="empty-state">
                            <MapPin size={48} className="empty-icon" />
                            <p>No gyms configured.</p>
                            <button
                                className="add-first-btn"
                                onClick={() => setIsCreating(true)}
                            >
                                Create your first gym
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
