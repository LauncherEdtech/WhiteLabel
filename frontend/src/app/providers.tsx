// frontend/src/app/providers.tsx
// Centraliza todos os providers da aplicação.

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { TrackingProvider } from "@/components/TrackingProvider";

export function Providers({ children }: { children: React.ReactNode }) {
    // QueryClient por instância (evita compartilhar estado entre usuários no SSR)
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000,
                        retry: 1,
                        refetchOnWindowFocus: false,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <TrackingProvider>
                    {children}
                </TrackingProvider>
                <Toaster />
            </ThemeProvider>
            {process.env.NODE_ENV === "development" && (
                <ReactQueryDevtools initialIsOpen={false} />
            )}
        </QueryClientProvider>
    );
}