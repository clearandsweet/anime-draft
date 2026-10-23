import type { Metadata } from "next";
import "./shelf.css";

export const metadata: Metadata = {
  title: "Figure Shelf | Clear & Sweet",
  description:
    "Anime figure picks from your whole AniList or MyAnimeList: every show at your own score, matched to real listings with photos and prices.",
};

const FONTS = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Inter:wght@400;500;600;700&display=swap";

export default function ShelfLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shelf-root">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={FONTS} precedence="default" />
      {children}
    </div>
  );
}
