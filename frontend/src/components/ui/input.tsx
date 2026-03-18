// frontend/src/components/ui/input.tsx
import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, error, ...props }, ref) => (
        <input
            ref={ref}
            className={cn(
                "flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "transition-colors",
                error
                    ? "border-destructive focus:ring-destructive/50"
                    : "border-input hover:border-ring",
                className
            )}
            {...props}
        />
    )
);
Input.displayName = "Input";

export { Input };