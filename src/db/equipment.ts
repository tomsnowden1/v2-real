export interface EquipmentItem {
    id: string;
    name: string;
    category: string;
}

export const EQUIPMENT_DB: EquipmentItem[] = [
    // ── Free Weights ───────────────────────────────────────────────
    { id: 'eq-barbell', name: 'Barbell', category: 'Free Weights' },
    { id: 'eq-ez-bar', name: 'EZ Curl Bar', category: 'Free Weights' },
    { id: 'eq-hex-bar', name: 'Hex / Trap Bar', category: 'Free Weights' },
    { id: 'eq-db-light', name: 'Dumbbells (Up to 20 kg)', category: 'Free Weights' },
    { id: 'eq-db-heavy', name: 'Dumbbells (Heavy, 20 kg+)', category: 'Free Weights' },
    { id: 'eq-kb', name: 'Kettlebells', category: 'Free Weights' },
    { id: 'eq-plates', name: 'Weight Plates', category: 'Free Weights' },
    { id: 'eq-med-ball', name: 'Medicine Ball', category: 'Free Weights' },
    { id: 'eq-sandbag', name: 'Sandbag', category: 'Free Weights' },
    { id: 'eq-swiss-bar', name: 'Swiss / Football Bar', category: 'Free Weights' },

    // ── Benches ────────────────────────────────────────────────────
    { id: 'eq-bench-flat', name: 'Flat Bench', category: 'Benches' },
    { id: 'eq-bench-incline', name: 'Adjustable / Incline Bench', category: 'Benches' },
    { id: 'eq-preacher', name: 'Preacher Curl Bench', category: 'Benches' },
    { id: 'eq-back-ext', name: 'Roman Chair / Back Extension', category: 'Benches' },
    { id: 'eq-ghd', name: 'GHD (Glute Ham Developer)', category: 'Benches' },

    // ── Racks & Frames ─────────────────────────────────────────────
    { id: 'eq-squat-rack', name: 'Squat Rack / Power Rack', category: 'Racks & Frames' },
    { id: 'eq-half-rack', name: 'Half Rack', category: 'Racks & Frames' },
    { id: 'eq-smith', name: 'Smith Machine', category: 'Racks & Frames' },
    { id: 'eq-landmine', name: 'Landmine Attachment', category: 'Racks & Frames' },

    // ── Cable & Pulley Machines ────────────────────────────────────
    { id: 'eq-cables', name: 'Cables / Functional Trainer', category: 'Cable Machines' },
    { id: 'eq-cable-crossover', name: 'Cable Crossover', category: 'Cable Machines' },
    { id: 'eq-lat-pulldown', name: 'Lat Pulldown Machine', category: 'Cable Machines' },
    { id: 'eq-seated-row', name: 'Seated Cable Row', category: 'Cable Machines' },
    { id: 'eq-tbar-row', name: 'T-Bar Row Machine', category: 'Cable Machines' },

    // ── Selectorized Machines ──────────────────────────────────────
    { id: 'eq-leg-press', name: 'Leg Press', category: 'Selectorized Machines' },
    { id: 'eq-hack-squat', name: 'Hack Squat Machine', category: 'Selectorized Machines' },
    { id: 'eq-leg-ext', name: 'Leg Extension Machine', category: 'Selectorized Machines' },
    { id: 'eq-leg-curl-lying', name: 'Leg Curl (Lying)', category: 'Selectorized Machines' },
    { id: 'eq-leg-curl-seated', name: 'Leg Curl (Seated)', category: 'Selectorized Machines' },
    { id: 'eq-hip-abductor', name: 'Hip Abductor / Adductor', category: 'Selectorized Machines' },
    { id: 'eq-chest-press', name: 'Chest Press Machine', category: 'Selectorized Machines' },
    { id: 'eq-pec-deck', name: 'Pec Deck / Fly Machine', category: 'Selectorized Machines' },
    { id: 'eq-shoulder-press', name: 'Shoulder Press Machine', category: 'Selectorized Machines' },
    { id: 'eq-assisted-pullup', name: 'Assisted Pull-Up Machine', category: 'Selectorized Machines' },
    { id: 'eq-multi-station', name: 'Multi-Station / Universal', category: 'Selectorized Machines' },
    { id: 'eq-calf-raise', name: 'Calf Raise Machine', category: 'Selectorized Machines' },
    { id: 'eq-glute-kickback', name: 'Glute Kickback Machine', category: 'Selectorized Machines' },

    // ── Cardio ─────────────────────────────────────────────────────
    { id: 'eq-treadmill', name: 'Treadmill', category: 'Cardio' },
    { id: 'eq-bike', name: 'Stationary Bike', category: 'Cardio' },
    { id: 'eq-bike-assault', name: 'Air Bike / Assault Bike', category: 'Cardio' },
    { id: 'eq-rower', name: 'Rowing Machine', category: 'Cardio' },
    { id: 'eq-ski-erg', name: 'Ski Erg', category: 'Cardio' },
    { id: 'eq-elliptical', name: 'Elliptical', category: 'Cardio' },
    { id: 'eq-stair-climber', name: 'Stair Climber / StepMill', category: 'Cardio' },
    { id: 'eq-jump-rope', name: 'Jump Rope', category: 'Cardio' },

    // ── Bodyweight & Functional ────────────────────────────────────
    { id: 'eq-pullup', name: 'Pull-Up Bar', category: 'Bodyweight & Functional' },
    { id: 'eq-dip', name: 'Dip Station', category: 'Bodyweight & Functional' },
    { id: 'eq-rings', name: 'Gymnastic Rings', category: 'Bodyweight & Functional' },
    { id: 'eq-trx', name: 'TRX / Suspension Trainer', category: 'Bodyweight & Functional' },
    { id: 'eq-parallettes', name: 'Parallette Bars', category: 'Bodyweight & Functional' },
    { id: 'eq-ab-wheel', name: 'Ab Wheel', category: 'Bodyweight & Functional' },
    { id: 'eq-battle-ropes', name: 'Battle Ropes', category: 'Bodyweight & Functional' },
    { id: 'eq-plyo-box', name: 'Plyo Box', category: 'Bodyweight & Functional' },
    { id: 'eq-bands', name: 'Resistance Bands', category: 'Bodyweight & Functional' },
    { id: 'eq-foam-roller', name: 'Foam Roller', category: 'Bodyweight & Functional' },
];
