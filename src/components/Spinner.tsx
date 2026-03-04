import './StateComponents.css';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    label?: string;
}

export default function Spinner({ size = 'md', label }: SpinnerProps) {
    return (
        <div className="spinner-wrapper">
            <div className={`spinner spinner-${size}`} />
            {label && <span className="spinner-label">{label}</span>}
        </div>
    );
}
