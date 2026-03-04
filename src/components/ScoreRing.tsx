import './ScoreRing.css';

interface ScoreRingProps {
    score: number;
    size?: number;
    strokeWidth?: number;
    label?: string;
}

export default function ScoreRing({ score, size = 120, strokeWidth = 12, label = 'Score' }: ScoreRingProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    // Determine color based on score thresholds
    let colorClass = 'score-excellent';
    if (score < 60) colorClass = 'score-needs-work';
    else if (score < 85) colorClass = 'score-good';

    const fontSize = Math.round(size * 0.35);

    return (
        <div className="score-ring-container" style={{ width: size, height: size }}>
            <svg
                className="score-ring-svg"
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
            >
                {/* Background Ring */}
                <circle
                    className="score-ring-bg"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />

                {/* Progress Ring */}
                <circle
                    className={`score-ring-progress ${colorClass}`}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
            </svg>
            <div className="score-ring-content">
                <span
                    className={`score-ring-value ${colorClass}`}
                    style={{ fontSize: `${fontSize}px` }}
                >
                    {score}
                </span>
                {label && <span className="score-ring-label">{label}</span>}
            </div>
        </div>
    );
}
