import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Custom Rankings | Clear & Sweet",
  description:
    "Make, search, and play community blind rankings with a fresh randomized set every game.",
  openGraph: {
    title: "Custom Rankings | Clear & Sweet",
    description: "Make the list. Hide the order. Let everyone rank it blind.",
    images: [
      {
        url: "/custom-rankings-og.png",
        width: 1732,
        height: 909,
        alt: "Custom Rankings with five surprise cards and a numbered board.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Custom Rankings | Clear & Sweet",
    description: "Make the list. Hide the order. Let everyone rank it blind.",
    images: ["/custom-rankings-og.png"],
  },
};

export default function CustomRankingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
