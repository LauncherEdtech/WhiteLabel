// frontend/src/components/shared/DifficultyBadge.tsx
import { cn } from "@/lib/utils/cn";
import type { DifficultyLevel } from "@/types/api";

const config: Record<DifficultyLevel, { label: string; className: string }> = {
    easy: { label: "Fácil", className: "bg-success/10 text-success" },
    medium: { label: "Médio", className: "bg-warning/10 text-warning" },
    hard: { label: "Difícil", className: "bg-destructive/10 text-destructive" },
};

function DifficultyBadge({ difficulty }: { difficulty: DifficultyLevel | null }) {
    if (!difficulty) return null;
    const { label, className } = config[difficulty];
    return (
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-md", className)}>
            {label}
        </span>
    );
}

export { DifficultyBadge };