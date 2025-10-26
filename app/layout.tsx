// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anime Character Draft",
  description:
    "Live snake draft for anime characters. Build your Waifu/Husbando/Not Living/Child/Minor Character lineup and compete with friends.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Anime Character Draft",
    description:
      "Draft anime characters into slots with your friends. Timed snake draft, auto-pick, exportable rosters.",
    url: "https://animedraft.godisaloli.com",
    siteName: "Anime Character Draft",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Anime Character Draft",
    description:
      "Snake draft anime characters into Waifu / Husbando / Not Living / Child / etc. with a timer.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="bg-neutral-900 text-neutral-100"
      suppressHydrationWarning
    >
      <body className="bg-neutral-900 text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
