// frontend/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    turbopack: {
        root: __dirname,   // ← Fix do warning de workspace root
    },
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "**.amazonaws.com" },
            { protocol: "https", hostname: "**.cloudfront.net" },
        ],
    },
    async rewrites() {
        return process.env.NODE_ENV === "development"
            ? [
                {
                    source: "/api/:path*",
                    destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1"}/:path*`,
                },
            ]
            : [];
    },
};

export default nextConfig;