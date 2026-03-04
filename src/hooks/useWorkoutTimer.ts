import { useState, useEffect } from 'react';

/**
 * Encapsulates the workout elapsed-time display.
 * Returns a formatted "MM:SS" string that ticks every second while active.
 */
export function useWorkoutTimer(isActive: boolean, startTime: number | null): string {
    const [elapsedStr, setElapsedStr] = useState('00:00');

    useEffect(() => {
        if (!isActive || !startTime) {
            setElapsedStr('00:00');
            return;
        }
        const interval = setInterval(() => {
            const now = Date.now();
            const diff = Math.floor((now - startTime) / 1000);
            const m = Math.floor(diff / 60).toString().padStart(2, '0');
            const s = (diff % 60).toString().padStart(2, '0');
            setElapsedStr(`${m}:${s}`);
        }, 1000);
        return () => clearInterval(interval);
    }, [isActive, startTime]);

    return elapsedStr;
}
