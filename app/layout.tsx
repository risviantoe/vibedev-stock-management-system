import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/inter";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  const fallback = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const baseUrl = new URL(host ? `${protocol}://${host}` : fallback);
  const description =
    "Sistem operasional gudang untuk mengelola stok per produk dan batch secara akurat serta mudah ditelusuri.";

  return {
    metadataBase: baseUrl,
    title: {
      default: "StokLedger — Kontrol Persediaan",
      template: "%s · StokLedger",
    },
    description,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      type: "website",
      title: "StokLedger — Kontrol Persediaan per Batch",
      description,
      url: baseUrl,
      images: [
        {
          url: new URL("/og.png", baseUrl).toString(),
          width: 1672,
          height: 941,
          alt: "StokLedger — kontrol persediaan dan riwayat stok gudang.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "StokLedger — Kontrol Persediaan per Batch",
      description,
      images: [new URL("/og.png", baseUrl).toString()],
    },
  };
}

import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
