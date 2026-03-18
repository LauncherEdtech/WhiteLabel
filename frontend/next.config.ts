// frontend/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    turbopack: {
        root: __dirname,
    },
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "**.amazonaws.com" },
            { protocol: "https", hostname: "**.cloudfront.net" },
            { protocol: "https", hostname: "**" }, // dev/Codespaces
        ],
    },
    async rewrites() {
        // Proxy server-side: browser chama /api/* → Next.js repassa para Flask
        // Funciona em dev (Codespaces) e produção sem CORS
        return [
            {
                source: "/api/:path*",
                destination: "http://localhost:5000/api/:path*", // direto, sem /v1 duplicado
            },
        ];
    },
};

export default nextConfig;