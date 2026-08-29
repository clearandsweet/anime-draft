import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blind Ranking | Clear & Sweet",
  description:
    "Blind-rank anime and characters one reveal at a time, solo or with a shared multiplayer room.",
  openGraph: {
    title: "Blind Ranking | Clear & Sweet",
    description:
      "Rank now. Regret later. Blind-rank anime and characters one reveal at a time.",
    images: [
      {
        url: "/blind-ranking-og.png",
        width: 1732,
        height: 909,
        alt: "Blind Ranking — rank now, regret later.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blind Ranking | Clear & Sweet",
    description:
      "Rank now. Regret later. Blind-rank anime and characters one reveal at a time.",
    images: ["/blind-ranking-og.png"],
  },
};

export default function BlindRankingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
