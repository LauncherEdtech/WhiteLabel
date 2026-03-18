// frontend/src/components/shared/ProgressBar.tsx
import { cn } from "@/lib/utils/cn";

interface ProgressBarProps {
    value: number;   // 0-100
    label?: string;
    showPercent?: boolean;
    color?: "primary" | "success" | "warning" | "destructive";
    size?: "sm" | "md";
    className?: string;
}

const colorMap = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
};

const sizeMap = { sm: "h-1.5", md: "h-2.5" };

function ProgressBar({ value, label, showPercent, color = "primary", size = "md", className }: ProgressBarProps) {
    return (
        <div className={cn("space-y-1.5", className)}>
            {(label || showPercent) && (
                <div className="flex justify-between items-center">
                    {label && <span className="text-xs text-muted-foreground">{label}</span>}
                    {showPercent && <span className="text-xs font-medium text-foreground">{Math.round(value)}%</span>}
                </div>
            )}
            <div className={cn("w-full rounded-full bg-muted overflow-hidden", sizeMap[size])}>
                <div
                    className={cn("h-full rounded-full transition-all duration-500", colorMap[color])}
                    style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
                />
            </div>
        </div>
    );
}

export { ProgressBar };