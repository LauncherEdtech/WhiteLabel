// frontend/src/components/ui/progress.tsx
"use client";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils/cn";

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
    indicatorClassName?: string;
}

function Progress({ className, value, indicatorClassName, ...props }: ProgressProps) {
    return (
        <ProgressPrimitive.Root
            className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
            {...props}
        >
            <ProgressPrimitive.Indicator
                className={cn("h-full rounded-full bg-primary transition-all duration-500", indicatorClassName)}
                style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
            />
        </ProgressPrimitive.Root>
    );
}

export { Progress };