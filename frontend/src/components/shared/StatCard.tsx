// frontend/src/components/shared/StatCard.tsx
import { cn } from "@/lib/utils/cn";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
    icon?: React.ReactNode;
    label: string;
    value: string | number;
    sub?: string;
    trend?: { value: number; label: string };
    color?: "primary" | "secondary" | "success" | "warning" | "destructive";
    className?: string;
}

const colorMap = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
};

function StatCard({ icon, label, value, sub, trend, color = "primary", className }: StatCardProps) {
    return (
        <Card className={cn("animate-fade-in", className)}>
            <CardContent className="p-4">
                {icon && (
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-3", colorMap[color])}>
                        {icon}
                    </div>
                )}
                <p className="text-2xl font-display font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
                {trend && (
                    <p className={cn("text-xs font-medium mt-1", trend.value >= 0 ? "text-success" : "text-destructive")}>
                        {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

export { StatCard };