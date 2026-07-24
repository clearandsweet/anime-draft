// app/layout.tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "Clearandsweet | Kai Andersen";
const description =
  "Formal critical analysis of anime by Clearandsweet (Kai Andersen): visual storytelling breakdowns, panels, interviews, long-form discussion, and live draft games.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = new URL(`${protocol}://${host}`);
  const socialImage = new URL("/og.png", origin).toString();

  return {
    metadataBase: origin,
    title,
    description,
    icons: {
      icon: "/favicon.ico",
    },
    openGraph: {
      title,
      description,
      url: origin,
      siteName: "Clearandsweet",
      type: "website",
      images: [
        {
          url: socialImage,
          width: 1728,
          height: 905,
          alt: "Clearandsweet — Anime criticism built on formal analysis.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}

