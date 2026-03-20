import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "")
    || "http://localhost:5000";

const nextConfig: NextConfig = {
    output: "standalone",
    turbopack: { root: __dirname },
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "**.amazonaws.com" },
            { protocol: "http", hostname: "**.amazonaws.com" },
            { protocol: "https", hostname: "**" },
        ],
    },
    async rewrites() {
        return [
            {
                source: "/api/:path*",
                destination: `${API_URL}/api/:path*`,
            },
        ];
    },
};

export default nextConfig;