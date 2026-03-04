interface WizardShellProps {
    children: React.ReactNode;
    onBack?: () => void;
    title?: string;
    subtitle?: string;
    /** Optional dot progress indicators (e.g. [true, false] = 2 dots, first active) */
    dots?: boolean[];
    className?: string;
}

/**
 * Shared layout wrapper for wizard steps.
 * Renders back button, optional progress dots, header title + subtitle, and step content.
 */
export default function WizardShell({ children, onBack, title, subtitle, dots, className = '' }: WizardShellProps) {
    return (
        <div className={`wizard-step ${className}`}>
            {dots && (
                <div className="step-dots">
                    {dots.map((active, i) => (
                        <div key={i} className={`step-dot ${active ? 'active' : 'completed'}`} />
                    ))}
                </div>
            )}
            {(onBack || title) && (
                <div className="goal-header goal-header-margin-top">
                    {onBack && (
                        <button className="back-btn-wizard" onClick={onBack}>← Back</button>
                    )}
                    {title && <h1 className="h1-margin-top-medium">{title}</h1>}
                    {subtitle && <p>{subtitle}</p>}
                </div>
            )}
            {children}
        </div>
    );
}
