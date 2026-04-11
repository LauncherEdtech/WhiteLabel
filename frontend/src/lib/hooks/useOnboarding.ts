// frontend/src/lib/hooks/useOnboarding.ts
import { useAuthStore } from "@/lib/stores/authStore";

export function useOnboarding() {
    const { user } = useAuthStore();

    const settings = (user as any)?.settings || {};
    const onboarding = settings.onboarding || {};

    // Mostra onboarding se nunca completou E nunca pulou
    const needsOnboarding = !!user && !onboarding.completed && !onboarding.skipped;
    const initialStep = onboarding.tour_step || 0;

    return { needsOnboarding, initialStep };
}