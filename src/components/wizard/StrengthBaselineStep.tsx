import { useState } from 'react';
import WizardShell from './WizardShell';
import type { StrengthBaselines } from '../../db/database';

const BIG_LIFTS: { key: keyof StrengthBaselines; label: string }[] = [
    { key: 'squat', label: 'Squat' },
    { key: 'benchPress', label: 'Bench Press' },
    { key: 'deadlift', label: 'Deadlift' },
    { key: 'overheadPress', label: 'Overhead Press' },
    { key: 'barbellRow', label: 'Barbell Row' },
    { key: 'bicepCurl', label: 'Bicep Curl' },
];

interface StrengthBaselineStepProps {
    onBack: () => void;
    onContinue: (data: { weightUnit: 'lbs' | 'kg'; baselines: StrengthBaselines }) => void;
    onSkip: () => void;
    initialUnit?: 'lbs' | 'kg';
    initialBaselines?: StrengthBaselines;
}

export default function StrengthBaselineStep({
    onBack,
    onContinue,
    onSkip,
    initialUnit = 'lbs',
    initialBaselines,
}: StrengthBaselineStepProps) {
    const [unit, setUnit] = useState<'lbs' | 'kg'>(initialUnit);
    const [baselines, setBaselines] = useState<StrengthBaselines>(initialBaselines ?? {});

    const handleChange = (key: keyof StrengthBaselines, val: string) => {
        const num = parseFloat(val);
        setBaselines(prev => ({
            ...prev,
            [key]: val === '' || isNaN(num) ? undefined : num,
        }));
    };

    return (
        <WizardShell
            onBack={onBack}
            title="Your Starting Strength"
            subtitle="What weight do you comfortably lift for 8 reps? Estimates are totally fine!"
        >
            {/* lbs / kg toggle */}
            <div className="baseline-unit-toggle">
                <button
                    className={`unit-toggle-btn${unit === 'lbs' ? ' active' : ''}`}
                    onClick={() => setUnit('lbs')}
                >
                    lbs
                </button>
                <button
                    className={`unit-toggle-btn${unit === 'kg' ? ' active' : ''}`}
                    onClick={() => setUnit('kg')}
                >
                    kg
                </button>
            </div>

            {/* Exercise inputs */}
            <div className="baseline-inputs">
                {BIG_LIFTS.map(lift => (
                    <div key={lift.key} className="baseline-row">
                        <label className="baseline-label">{lift.label}</label>
                        <div className="baseline-input-wrap">
                            <input
                                type="number"
                                min="0"
                                step="2.5"
                                className="baseline-input"
                                placeholder="—"
                                value={baselines[lift.key] ?? ''}
                                onChange={e => handleChange(lift.key, e.target.value)}
                            />
                            <span className="baseline-unit-label">{unit}</span>
                        </div>
                    </div>
                ))}
            </div>

            <button
                className="goal-save-btn button-margin-top-large"
                onClick={() => onContinue({ weightUnit: unit, baselines })}
            >
                Continue
            </button>

            <button className="baseline-skip-btn" onClick={onSkip}>
                I don't know / This is my first time
            </button>
        </WizardShell>
    );
}
