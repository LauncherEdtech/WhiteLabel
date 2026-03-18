// frontend/src/components/ui/empty-state.tsx
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: { label: string; onClick: () => void };
    className?: string;
}

function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div className={cn("flex flex-col items-center justify-center py-16 text-center gap-3", className)}>
            {icon && (
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                    {icon}
                </div>
            )}
            <div>
                <p className="font-semibold text-foreground">{title}</p>
                {description && (
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{description}</p>
                )}
            </div>
            {action && (
                <Button variant="outline" onClick={action.onClick}>
                    {action.label}
                </Button>
            )}
        </div>
    );
}

export { EmptyState };