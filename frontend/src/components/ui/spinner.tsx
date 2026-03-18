// frontend/src/components/ui/spinner.tsx
import { cn } from "@/lib/utils/cn";

interface SpinnerProps {
    size?: "sm" | "md" | "lg";
    className?: string;
}

const sizeMap = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-10 w-10" };

function Spinner({ size = "md", className }: SpinnerProps) {
    return (
        <div
            className={cn(
                "rounded-full border-2 border-primary border-t-transparent animate-spin",
                sizeMap[size],
                className
            )}
        />
    );
}

export { Spinner };