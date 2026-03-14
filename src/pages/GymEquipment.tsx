import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getGymById, updateGym, addCustomEquipment, removeCustomEquipment } from '../db/gymService';
import { generateId } from '../lib/id';
import { ChevronLeft, Check, Search, Plus, X, Trash2 } from 'lucide-react';
import './GymEquipment.css';

import { EQUIPMENT_DB } from '../db/equipment';

const CATEGORIES_ORDER = [
    'Free Weights',
    'Benches',
    'Racks & Frames',
    'Cable Machines',
    'Selectorized Machines',
    'Cardio',
    'Bodyweight & Functional',
    'Custom',
];

export default function GymEquipment() {
    const { gymId } = useParams();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');

    // Add custom equipment modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [customName, setCustomName] = useState('');
    const [customCategory, setCustomCategory] = useState('Custom');
    const [addError, setAddError] = useState('');

    const gym = useLiveQuery(() => gymId ? getGymById(gymId) : undefined, [gymId]);

    const toggleEquipment = async (equipmentId: string) => {
        if (!gym || !gymId) return;
        const isAvailable = gym.availableEquipmentIds.includes(equipmentId);
        const newEquipmentList = isAvailable
            ? gym.availableEquipmentIds.filter(id => id !== equipmentId)
            : [...gym.availableEquipmentIds, equipmentId];
        await updateGym(gymId, { availableEquipmentIds: newEquipmentList });
    };

    const handleAddCustom = async () => {
        const trimmed = customName.trim();
        if (!trimmed) { setAddError('Please enter a name.'); return; }
        if (!gymId) return;

        const id = `custom-${gymId}-${generateId()}`;
        await addCustomEquipment(gymId, {
            id,
            name: trimmed,
            category: customCategory || 'Custom',
        });

        setCustomName('');
        setCustomCategory('Custom');
        setAddError('');
        setShowAddModal(false);
    };

    const handleDeleteCustom = async (itemId: string) => {
        if (!gymId) return;
        await removeCustomEquipment(gymId, itemId);
    };

    if (!gym) return <div className="page-content gym-equip-page"><p style={{ padding: 20 }}>Loading...</p></div>;

    // Merge built-in + custom equipment into one unified list
    const customItems = (gym.customEquipment ?? []).map(c => ({ ...c, _isCustom: true }));
    const allItems = [
        ...EQUIPMENT_DB.map(e => ({ ...e, _isCustom: false })),
        ...customItems,
    ];

    const q = searchQuery.toLowerCase();
    const filtered = allItems.filter(eq =>
        eq.name.toLowerCase().includes(q) ||
        eq.category.toLowerCase().includes(q)
    );

    // Group by category in order
    const categorySet = new Set(filtered.map(e => e.category));
    const orderedCategories = CATEGORIES_ORDER.filter(c => categorySet.has(c));
    // Append any unknown categories not in the ordered list
    filtered.forEach(e => { if (!orderedCategories.includes(e.category)) orderedCategories.push(e.category); });

    const availableCategories = [
        'Free Weights', 'Benches', 'Racks & Frames', 'Cable Machines',
        'Selectorized Machines', 'Cardio', 'Bodyweight & Functional', 'Custom',
    ];

    return (
        <div className="page-content gym-equip-page">
            <header className="gym-equip-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ChevronLeft size={24} />
                    <span>Back</span>
                </button>
                <h1>{gym.name}</h1>
                <button className="add-custom-btn" onClick={() => setShowAddModal(true)} title="Add custom equipment">
                    <Plus size={20} />
                </button>
            </header>

            <div className="gym-equip-search-layer">
                <div className="search-input-wrapper">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search equipment"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                    {searchQuery && (
                        <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className="equip-list" style={{ paddingBottom: '40px' }}>
                {orderedCategories.map(category => {
                    const items = filtered.filter(eq => eq.category === category);
                    if (!items.length) return null;
                    return (
                        <div key={category} className="equip-category-group">
                            <h3 className="category-header">{category}</h3>

                            {items.map(eq => {
                                const isSelected = gym.availableEquipmentIds.includes(eq.id);
                                return (
                                    <div
                                        key={eq.id}
                                        className={`equip-item ${isSelected ? 'selected' : ''}`}
                                        onClick={() => toggleEquipment(eq.id)}
                                    >
                                        <div className="equip-info">
                                            <span className="equip-name">{eq.name}</span>
                                            <span className="equip-category">{eq.category}</span>
                                        </div>
                                        <div className="equip-row-actions">
                                            {eq._isCustom && (
                                                <button
                                                    className="delete-custom-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteCustom(eq.id);
                                                    }}
                                                    title="Remove custom equipment"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                            <div className={`checkbox-circle ${isSelected ? 'checked' : ''}`}>
                                                {isSelected && <Check size={14} strokeWidth={3} />}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}

                {filtered.length === 0 && (
                    <div className="equip-empty">
                        <p>No equipment found for "{searchQuery}"</p>
                    </div>
                )}
            </div>

            {/* Add Custom Equipment Modal */}
            {showAddModal && (
                <div className="equip-modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="equip-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="equip-modal-header">
                            <h2>Add Custom Equipment</h2>
                            <button className="equip-modal-close" onClick={() => setShowAddModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="equip-modal-body">
                            <div className="equip-field">
                                <label htmlFor="custom-name">Equipment Name</label>
                                <input
                                    id="custom-name"
                                    type="text"
                                    placeholder="e.g. Battle Rope, Sled, Yoke..."
                                    value={customName}
                                    onChange={(e) => { setCustomName(e.target.value); setAddError(''); }}
                                    autoFocus
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustom(); }}
                                />
                                {addError && <span className="equip-field-error">{addError}</span>}
                            </div>

                            <div className="equip-field">
                                <label htmlFor="custom-category">Category</label>
                                <select
                                    id="custom-category"
                                    value={customCategory}
                                    onChange={(e) => setCustomCategory(e.target.value)}
                                >
                                    {availableCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="equip-modal-footer">
                            <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className="btn-primary" onClick={handleAddCustom}>Add Equipment</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
