// frontend/src/lib/hooks/useTrack.ts
// Hook React principal para disparar eventos de tracking.
// Uso:
//   const track = useTrack();
//   track({ event_type: "mentor_click", feature_name: "mentor" });

import { useCallback } from "react";
import { track } from "@/lib/tracking/client";
import type { TrackEvent } from "@/lib/tracking/types";

export function useTrack() {
    return useCallback((event: TrackEvent) => {
        track(event);
    }, []);
}