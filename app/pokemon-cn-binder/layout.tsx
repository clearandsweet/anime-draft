import type { Metadata } from "next";
import "./binder.css";

export const metadata: Metadata = {
  title: "China-Only Card Binder | Clearandsweet",
  description:
    "Every Pokémon Illustration Rare and Special Art Rare whose artwork exists only in Simplified Chinese, with US eBay prices and 14-day price moves.",
};

const FONTS =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;500;600&display=swap";

export default function BinderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cnb-root">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={FONTS} precedence="default" />
      {children}
    </div>
  );
}
