import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
interface Props { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }
export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center gap-4", className)}>
      {icon && <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">{icon}</div>}
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
