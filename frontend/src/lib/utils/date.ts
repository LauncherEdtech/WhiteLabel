// frontend/src/lib/utils/date.ts
import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatDate(dateStr: string, pattern = "dd/MM/yyyy"): string {
    try {
        return format(parseISO(dateStr), pattern, { locale: ptBR });
    } catch {
        return dateStr;
    }
}

export function formatRelative(dateStr: string): string {
    try {
        const date = parseISO(dateStr);
        if (isToday(date)) return "hoje";
        if (isYesterday(date)) return "ontem";
        return formatDistanceToNow(date, { locale: ptBR, addSuffix: true });
    } catch {
        return dateStr;
    }
}

export function formatDayName(dateStr: string): string {
    try {
        const date = new Date(dateStr + "T12:00:00");
        if (isToday(date)) return "Hoje";
        return format(date, "EEEE, dd/MM", { locale: ptBR });
    } catch {
        return dateStr;
    }
}

export function isoDate(): string {
    return new Date().toISOString().split("T")[0];
}