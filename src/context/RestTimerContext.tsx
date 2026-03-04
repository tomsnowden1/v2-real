import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { db } from '../db/database';

interface RestTimerContextType {
    isRunning: boolean;
    remaining: number;          // seconds left
    totalDuration: number;      // total duration of this timer cycle
    exerciseName: string;       // name of the exercise that started the timer
    startTimer: (exerciseId: string, exerciseName: string) => void;
    skipTimer: () => void;
    adjustDuration: (delta: number) => void;
    getPreferredDuration: (exerciseId: string) => number;
    toastVisible: boolean;
    dismissToast: () => void;
    expanded: boolean;
    setExpanded: (v: boolean) => void;
}

const RestTimerContext = createContext<RestTimerContextType | undefined>(undefined);

const DEFAULT_REST = 90;

/** Generate a short beep using Web Audio API */
function playChime() {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Two‑tone ascending chime
        const now = ctx.currentTime;
        const tones = [
            { freq: 587.33, start: 0, end: 0.15 },   // D5
            { freq: 783.99, start: 0.12, end: 0.35 }, // G5
            { freq: 1046.5, start: 0.28, end: 0.55 }, // C6
        ];

        tones.forEach(({ freq, start, end }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, now + start);
            gain.gain.linearRampToValueAtTime(0.3, now + start + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + end);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + start);
            osc.stop(now + end + 0.05);
        });

        // Close context after tones finish
        setTimeout(() => ctx.close(), 800);
    } catch (e) {
        // Audio not available — fail silently
        console.debug('Web Audio API not supported', e);
    }
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
    const [isRunning, setIsRunning] = useState(false);
    const [remaining, setRemaining] = useState(0);
    const [totalDuration, setTotalDuration] = useState(DEFAULT_REST);
    const [exerciseName, setExerciseName] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const exerciseIdRef = useRef<string>('');
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Keep a ref for remaining so the interval callback always reads the latest value
    const remainingRef = useRef(0);

    // One-time migration: move localStorage rest prefs into Dexie
    useEffect(() => {
        const migrate = async () => {
            const saved = localStorage.getItem('ironai_rest_prefs');
            if (!saved) return;
            try {
                const prefs = JSON.parse(saved) as Record<string, number>;
                const entries = Object.entries(prefs).map(([exerciseId, durationSecs]) => ({
                    exerciseId,
                    durationSecs,
                }));
                if (entries.length > 0) {
                    await db.restTimerPrefs.bulkPut(entries);
                }
                localStorage.removeItem('ironai_rest_prefs');
            } catch (e) {
                console.warn('Rest prefs migration failed', e);
            }
        };
        migrate();
    }, []);

    const clearTimer = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const finishTimer = useCallback(() => {
        clearTimer();
        setIsRunning(false);
        setRemaining(0);
        remainingRef.current = 0;
        setExpanded(false);

        // Play chime
        playChime();

        // Vibrate if available
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);

        // Show toast
        setToastVisible(true);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToastVisible(false), 3000);
    }, [clearTimer]);

    const dismissToast = useCallback(() => {
        setToastVisible(false);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    }, []);

    // Returns DEFAULT_REST synchronously; actual pref is loaded async in startTimer
    const getPreferredDuration = useCallback((_exerciseId: string) => {
        return DEFAULT_REST;
    }, []);

    const startTimer = useCallback((exerciseId: string, name: string) => {
        clearTimer();
        exerciseIdRef.current = exerciseId;
        setExerciseName(name);

        // Load preferred duration from Dexie, then start the interval
        db.restTimerPrefs.get(exerciseId).then(rec => {
            const duration = rec?.durationSecs ?? DEFAULT_REST;
            setTotalDuration(duration);
            setRemaining(duration);
            remainingRef.current = duration;
            setIsRunning(true);
            setToastVisible(false);

            intervalRef.current = setInterval(() => {
                remainingRef.current -= 1;
                if (remainingRef.current <= 0) {
                    finishTimer();
                } else {
                    setRemaining(remainingRef.current);
                }
            }, 1000);
        }).catch(() => {
            // Fallback to default if Dexie read fails
            const duration = DEFAULT_REST;
            setTotalDuration(duration);
            setRemaining(duration);
            remainingRef.current = duration;
            setIsRunning(true);
            setToastVisible(false);

            intervalRef.current = setInterval(() => {
                remainingRef.current -= 1;
                if (remainingRef.current <= 0) {
                    finishTimer();
                } else {
                    setRemaining(remainingRef.current);
                }
            }, 1000);
        });
    }, [clearTimer, finishTimer]);

    const skipTimer = useCallback(() => {
        clearTimer();
        setIsRunning(false);
        setRemaining(0);
        remainingRef.current = 0;
        setExpanded(false);
    }, [clearTimer]);

    const adjustDuration = useCallback((delta: number) => {
        setTotalDuration(prev => {
            const next = Math.max(15, Math.min(300, prev + delta));
            // Persist preference to Dexie (fire-and-forget)
            if (exerciseIdRef.current) {
                db.restTimerPrefs.put({ exerciseId: exerciseIdRef.current, durationSecs: next })
                    .catch(e => console.warn('Failed to save rest pref', e));
            }
            return next;
        });

        if (isRunning) {
            remainingRef.current = Math.max(0, remainingRef.current + delta);
            setRemaining(remainingRef.current);
        }
    }, [isRunning]);

    // Cleanup on unmount
    useEffect(() => () => {
        clearTimer();
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    }, [clearTimer]);

    return (
        <RestTimerContext.Provider value={{
            isRunning,
            remaining,
            totalDuration,
            exerciseName,
            startTimer,
            skipTimer,
            adjustDuration,
            getPreferredDuration,
            toastVisible,
            dismissToast,
            expanded,
            setExpanded,
        }}>
            {children}
        </RestTimerContext.Provider>
    );
}

export function useRestTimer() {
    const context = useContext(RestTimerContext);
    if (!context) throw new Error('useRestTimer must be used within RestTimerProvider');
    return context;
}
