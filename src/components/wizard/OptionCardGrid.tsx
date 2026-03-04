interface OptionCard {
    id: string;
    title: string;
    desc: string;
    icon: React.ReactNode;
    color: string;
}

interface OptionCardGridProps {
    options: OptionCard[];
    selected: string | null;
    onSelect: (id: string) => void;
    singleCol?: boolean;
}

/**
 * Reusable card picker grid used by Goal, Experience, Equipment, and Persona wizard steps.
 */
export default function OptionCardGrid({ options, selected, onSelect, singleCol = false }: OptionCardGridProps) {
    return (
        <div className={`goal-grid ${singleCol ? 'goal-grid-single-col' : ''}`}>
            {options.map((opt) => (
                <div
                    key={opt.id}
                    className={`goal-card ${selected === opt.id ? 'selected' : ''}`}
                    onClick={() => onSelect(opt.id)}
                    style={{ '--nav-active': opt.color } as React.CSSProperties}
                >
                    <div className="goal-card-icon" style={{ backgroundColor: `${opt.color}15`, color: opt.color }}>
                        {opt.icon}
                    </div>
                    <div className="goal-card-text">
                        <h3>{opt.title}</h3>
                        <p>{opt.desc}</p>
                    </div>
                    <div className="goal-card-radio">
                        <div className="radio-inner" />
                    </div>
                </div>
            ))}
        </div>
    );
}
