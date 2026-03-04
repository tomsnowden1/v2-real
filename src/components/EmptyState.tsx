import type { ReactNode } from 'react';
import './StateComponents.css';

interface EmptyStateProps {
    icon: ReactNode;
    title: string;
    description?: string;
    action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="empty-state-container">
            <div className="empty-state-icon">{icon}</div>
            <h3 className="empty-state-title">{title}</h3>
            {description && <p className="empty-state-desc">{description}</p>}
            {action && (
                <button className="empty-state-action" onClick={action.onClick}>
                    {action.label}
                </button>
            )}
        </div>
    );
}
