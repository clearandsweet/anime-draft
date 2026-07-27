// app/layout.tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "Clearandsweet | Kai Andersen";
const description =
  "Anime video essays, projects, drafts, and quizzes by Kai Andersen.";

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
  const socialImage = new URL("/clear-and-sweet-botanical-v1.png", origin).toString();

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
          width: 1717,
          height: 916,
          alt: "Clear & Sweet in a botanical print frame.",
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

