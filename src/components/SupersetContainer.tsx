import React from 'react';
import './SupersetContainer.css';
import { Link2 } from 'lucide-react';

interface SupersetContainerProps {
    children: React.ReactNode;
}

export default function SupersetContainer({ children }: SupersetContainerProps) {
    return (
        <div className="superset-container">
            <div className="superset-indicator">
                <div className="superset-line"></div>
                <div className="superset-icon-badge">
                    <Link2 size={12} />
                </div>
            </div>
            <div className="superset-content">
                {children}
            </div>
        </div>
    );
}
