// frontend/src/components/ui/toaster.tsx
"use client";

import * as Toast from "@radix-ui/react-toast";
import { create } from "zustand";
import { cn } from "@/lib/utils/cn";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
    id: string;
    title: string;
    description?: string;
    type: ToastType;
}

interface ToastStore {
    toasts: ToastItem[];
    add: (toast: Omit<ToastItem, "id">) => void;
    remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
    toasts: [],
    add: (toast) =>
        set((s) => ({
            toasts: [...s.toasts, { ...toast, id: Math.random().toString(36) }],
        })),
    remove: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Hook de conveniência
export function useToast() {
    const add = useToastStore((s) => s.add);
    return {
        success: (title: string, description?: string) =>
            add({ title, description, type: "success" }),
        error: (title: string, description?: string) =>
            add({ title, description, type: "error" }),
        info: (title: string, description?: string) =>
            add({ title, description, type: "info" }),
    };
}

const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-success" />,
    error: <AlertCircle className="h-5 w-5 text-destructive" />,
    info: <Info className="h-5 w-5 text-primary" />,
};

export function Toaster() {
    const { toasts, remove } = useToastStore();

    return (
        <Toast.Provider swipeDirection="right">
            {toasts.map((toast) => (
                <Toast.Root
                    key={toast.id}
                    open
                    onOpenChange={(open) => !open && remove(toast.id)}
                    duration={4000}
                    className={cn(
                        "flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-lg",
                        "data-[state=open]:animate-fade-in",
                        "data-[state=closed]:opacity-0 data-[state=closed]:translate-x-4 transition-all"
                    )}
                >
                    {icons[toast.type]}
                    <div className="flex-1 min-w-0">
                        <Toast.Title className="text-sm font-medium text-foreground">
                            {toast.title}
                        </Toast.Title>
                        {toast.description && (
                            <Toast.Description className="mt-0.5 text-xs text-muted-foreground">
                                {toast.description}
                            </Toast.Description>
                        )}
                    </div>
                    <Toast.Close
                        onClick={() => remove(toast.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </Toast.Close>
                </Toast.Root>
            ))}
            <Toast.Viewport className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm" />
        </Toast.Provider>
    );
}