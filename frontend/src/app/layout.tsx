// frontend/src/app/layout.tsx

import { TenantBrandingLoader } from "@/components/TenantBrandingLoader";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { DM_Sans, Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Plataforma de Estudos",
  description: "Prepare-se para o seu concurso",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${dmSans.variable} ${sora.variable} antialiased`}>
        <Providers>
          <TenantBrandingLoader />
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}