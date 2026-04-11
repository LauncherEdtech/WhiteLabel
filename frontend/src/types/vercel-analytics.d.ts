declare module "@vercel/analytics/next" {
    import * as React from "react";
    export function Analytics(props?: Record<string, unknown>): React.JSX.Element | null;
}
