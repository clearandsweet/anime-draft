// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clearandsweet | Kai Andersen",
  description:
    "Formal critical analysis of anime by Clearandsweet (Kai Andersen): visual storytelling breakdowns, panels, interviews, and long-form discussion.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Clearandsweet | Kai Andersen",
    description:
      "Anime criticism and visual storytelling analysis: Madoka, Haruhi, Utena, convention panels, interviews, and more.",
    url: "https://godisaloli.com",
    siteName: "Clearandsweet",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clearandsweet | Kai Andersen",
    description:
      "In-depth anime criticism, visual storytelling essays, and curated projects.",
  },
};

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

