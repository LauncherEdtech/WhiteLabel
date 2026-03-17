// frontend/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Output standalone para Docker em produção
    output: "standalone",

    // Permite imagens de domínios externos (logos dos tenants no S3)
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**.amazonaws.com",
            },
            {
                protocol: "https",
                hostname: "**.cloudfront.net",
            },
        ],
    },

    // Em dev, faz proxy das chamadas /api/* para o Flask
    async rewrites() {
        return process.env.NODE_ENV === "development"
            ? [
                {
                    source: "/api/:path*",
                    destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/:path*`,
                },
            ]
            : [];
    },
};

export default nextConfig;