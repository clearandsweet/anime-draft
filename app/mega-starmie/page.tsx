import type { Metadata } from "next";
import Link from "next/link";
import MegaStarmieSim from "./MegaStarmieSim";

export const metadata: Metadata = {
  title: "Mega Starmie Deck Simulation Tool | Clearandsweet",
  description:
    "Monte Carlo opening-hand simulator for a Mega Starmie ex / Mega Froslass ex Pokémon TCG deck: turn-one attack odds going second, going-first starts, and outcome breakdowns.",
};

export default function MegaStarmiePage() {
  return (
    <div style={{ position: "relative" }}>
      <Link
        href="/"
        style={{
          position: "absolute",
          top: 14,
          left: 18,
          zIndex: 1,
          fontFamily: "'Space Mono', monospace",
          fontSize: 12,
          color: "#8b949e",
          textDecoration: "none",
        }}
      >
        ← Clearandsweet
      </Link>
      <MegaStarmieSim />
    </div>
  );
}
