// frontend/src/lib/utils/time.ts
// Utilitários para o timer do simulado

export function secondsToDisplay(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) {
        return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function isTimeCritical(seconds: number): boolean {
    return seconds > 0 && seconds <= 300; // últimos 5 minutos
}

export function timerColor(seconds: number): string {
    if (seconds <= 60) return "text-destructive";
    if (seconds <= 300) return "text-warning";
    return "text-foreground";
}