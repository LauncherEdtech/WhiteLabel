// frontend/src/lib/hooks/useTimer.ts
import { useState, useEffect, useRef, useCallback } from "react";

interface UseTimerOptions {
    initialSeconds: number;
    autoStart?: boolean;
    onExpire?: () => void;
    direction?: "down" | "up";
}

export function useTimer({
    initialSeconds,
    autoStart = false,
    onExpire,
    direction = "down",
}: UseTimerOptions) {
    const [seconds, setSeconds] = useState(initialSeconds);
    const [isRunning, setIsRunning] = useState(autoStart);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const onExpireRef = useRef(onExpire);

    // Mantém a referência atual sem re-criar o intervalo
    useEffect(() => {
        onExpireRef.current = onExpire;
    }, [onExpire]);

    const clear = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!isRunning) {
            clear();
            return;
        }

        intervalRef.current = setInterval(() => {
            setSeconds((prev) => {
                if (direction === "down") {
                    if (prev <= 1) {
                        clear();
                        setIsRunning(false);
                        onExpireRef.current?.();
                        return 0;
                    }
                    return prev - 1;
                } else {
                    return prev + 1;
                }
            });
        }, 1000);

        return clear;
    }, [isRunning, direction, clear]);

    // Reinicia quando initialSeconds mudar (ex: após carregar o simulado)
    useEffect(() => {
        setSeconds(initialSeconds);
    }, [initialSeconds]);

    const start = useCallback(() => setIsRunning(true), []);
    const pause = useCallback(() => setIsRunning(false), []);
    const reset = useCallback(() => {
        setIsRunning(false);
        setSeconds(initialSeconds);
    }, [initialSeconds]);

    // Formata mm:ss
    const formatted = (() => {
        const abs = Math.abs(seconds);
        const h = Math.floor(abs / 3600);
        const m = Math.floor((abs % 3600) / 60);
        const s = abs % 60;
        if (h > 0) {
            return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
        }
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    })();

    const percentRemaining =
        direction === "down" && initialSeconds > 0
            ? Math.round((seconds / initialSeconds) * 100)
            : 0;

    return {
        seconds,
        formatted,
        isRunning,
        percentRemaining,
        start,
        pause,
        reset,
    };
}