// frontend/src/lib/hooks/useTimer.ts
// Timer regressivo para o simulado
"use client";
import { useEffect, useRef, useState, useCallback } from "react";

interface UseTimerOptions {
    initialSeconds: number;
    onExpire?: () => void;
    autoStart?: boolean;
}

export function useTimer({ initialSeconds, onExpire, autoStart = true }: UseTimerOptions) {
    const [seconds, setSeconds] = useState(initialSeconds);
    const [running, setRunning] = useState(autoStart);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const expiredRef = useRef(false);

    const stop = useCallback(() => {
        setRunning(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
    }, []);

    const start = useCallback(() => setRunning(true), []);

    useEffect(() => {
        if (!running) return;

        intervalRef.current = setInterval(() => {
            setSeconds((s) => {
                if (s <= 1) {
                    clearInterval(intervalRef.current!);
                    setRunning(false);
                    if (!expiredRef.current) {
                        expiredRef.current = true;
                        onExpire?.();
                    }
                    return 0;
                }
                return s - 1;
            });
        }, 1000);

        return () => clearInterval(intervalRef.current!);
    }, [running, onExpire]);

    return { seconds, running, start, stop };
}