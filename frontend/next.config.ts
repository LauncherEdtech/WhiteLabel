import type { NextConfig } from "next";

// API_URL: base sem /api/v1
// Em produção: https://launcheredu.com.br (via NEXT_PUBLIC_API_URL)
// Em dev:      http://localhost:5000
const API_URL =
    process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") ||
    "http://localhost:5000";

const nextConfig: NextConfig = {
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
                // IMPORTANTE: usa /api/v1/* e NÃO /api/* para não capturar
                // as rotas internas do Next.js em /api/tenant, /api/auth, etc.
                source: "/api/v1/:path*",
                destination: `${API_URL}/api/v1/:path*`,
            },
        ];
    },
};

export default nextConfig;