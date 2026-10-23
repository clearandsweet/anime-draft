import type { Metadata } from "next";
import "./shelf.css";

export const metadata: Metadata = {
  title: "Figure Shelf | Clear & Sweet",
  description:
    "Anime figure picks ranked by your own AniList or MyAnimeList scores, figure quality, and how loved each character is.",
};

export default function ShelfLayout({ children }: { children: React.ReactNode }) {
  return children;
}
