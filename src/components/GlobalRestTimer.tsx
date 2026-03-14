import { useRestTimer } from '../context/RestTimerContext';
import { X, CheckCircle } from 'lucide-react';
import './GlobalRestTimer.css';

/** Small SVG ring for the floating pill */
function PillRing({ pct, color }: { pct: number; color: string }) {
    const r = 16;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - pct);
    return (
        <svg className="rest-pill__ring" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-border)" strokeWidth="3.5" />
            <circle
                cx="20" cy="20" r={r} fill="none"
                stroke={color} strokeWidth="3.5"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.9s linear', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
            />
        </svg>
    );
}

/** Large SVG ring for the fullscreen overlay */
function OverlayRing({ pct, color }: { pct: number; color: string }) {
    const r = 90;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - pct);
    return (
        <svg width="220" height="220" viewBox="0 0 220 220" aria-hidden="true">
            <circle cx="110" cy="110" r={r} fill="none" stroke="var(--color-border)" strokeWidth="8" />
            <circle
                cx="110" cy="110" r={r} fill="none"
                stroke={color} strokeWidth="8"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.9s linear', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
            />
        </svg>
    );
}

function formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function getTimerColor(pct: number): string {
    if (pct > 0.5) return 'var(--color-primary)';
    if (pct > 0.25) return '#f59e0b';
    return '#ef4444';
}

export default function GlobalRestTimer() {
    const {
        isRunning,
        remaining,
        totalDuration,
        exerciseName,
        skipTimer,
        adjustDuration,
        toastVisible,
        dismissToast,
        expanded,
        setExpanded,
    } = useRestTimer();

    const pct = totalDuration > 0 ? remaining / totalDuration : 0;
    const color = getTimerColor(pct);
    const timeStr = formatTime(remaining);

    // ── Toast ──
    if (toastVisible && !isRunning) {
        return (
            <div className="rest-toast" onClick={dismissToast}>
                <CheckCircle size={18} />
                Rest Complete
            </div>
        );
    }

    if (!isRunning) return null;

    // ── Fullscreen Overlay ──
    if (expanded) {
        return (
            <div className="rest-overlay">
                <button className="rest-overlay__close" onClick={() => setExpanded(false)} aria-label="Minimize">
                    <X size={20} />
                </button>

                <span className="rest-overlay__exercise">{exerciseName}</span>

                <div className="rest-overlay__ring-wrap">
                    <OverlayRing pct={pct} color={color} />
                    <span className="rest-overlay__time-big">{timeStr}</span>
                </div>

                <div className="rest-overlay__controls">
                    <button className="rest-overlay__nudge" onClick={() => adjustDuration(-15)}>−15s</button>
                    <span className="rest-overlay__duration">{totalDuration}s</span>
                    <button className="rest-overlay__nudge" onClick={() => adjustDuration(15)}>+15s</button>
                </div>

                <button className="rest-overlay__skip" onClick={skipTimer}>Skip Rest</button>
            </div>
        );
    }

    // ── Floating Pill ──
    return (
        <div className="rest-pill" onClick={() => setExpanded(true)}>
            <PillRing pct={pct} color={color} />
            <div className="rest-pill__info">
                <span className="rest-pill__time">{timeStr}</span>
                <span className="rest-pill__label">{exerciseName}</span>
            </div>
        </div>
    );
}
