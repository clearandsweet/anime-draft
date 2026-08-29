"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CustomRankingSummary } from "../../lib/customRanking";
import { readApiResponse } from "../../lib/apiResponse";

export default function CustomRankingsPage() {
  const [query, setQuery] = useState("");
  const [rankings, setRankings] = useState<CustomRankingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/blind-ranking/custom?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal, cache: "no-store" }
        );
        const data = await readApiResponse<{
          rankings?: CustomRankingSummary[];
          error?: string;
        }>(response);
        if (!response.ok || !data.rankings) throw new Error(data.error || "Rankings could not be loaded.");
        setRankings(data.rankings);
      } catch (caught) {
        if ((caught as Error).name !== "AbortError") {
          setError(caught instanceof Error ? caught.message : "Rankings could not be loaded.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <main className="blind-page custom-library-page">
      <div className="blind-orbit blind-orbit-one" />
      <nav className="blind-nav">
        <Link href="/blind-ranking">Blind Ranking</Link>
        <span>Community Library</span>
      </nav>

      <header className="custom-library-hero">
        <div>
          <p className="blind-eyebrow">Made by everybody</p>
          <h1>Pick a list.<br />Trust your gut.</h1>
        </div>
        <div className="custom-library-intro">
          <p>
            Every game shuffles the pool and reveals one choice at a time. Search
            by ranking, creator, tag, or anything inside the list.
          </p>
          <Link className="blind-primary-action" href="/blind-ranking/custom/new">
            Make a ranking
          </Link>
        </div>
      </header>

      <section className="custom-search-shell">
        <label htmlFor="custom-ranking-search">Find a ranking</label>
        <input
          id="custom-ranking-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Magical girls, best snacks, made by Kai…"
          autoComplete="off"
        />
        <span>{loading ? "Searching…" : `${rankings.length} found`}</span>
      </section>

      {error ? <p className="blind-error" role="alert">{error}</p> : null}

      <section className="custom-ranking-grid" aria-live="polite">
        {!loading && rankings.length === 0 ? (
          <div className="custom-empty-state">
            <strong>No rankings found.</strong>
            <p>Try a broader search, or make the first one.</p>
          </div>
        ) : null}
        {rankings.map((ranking) => (
          <Link
            className="custom-ranking-card"
            href={`/blind-ranking/custom/${ranking.slug}`}
            key={ranking.id}
          >
            <div className="custom-ranking-covers">
              {ranking.coverImages.map((image, index) => (
                // Uploaded community artwork is served by the site image route.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" key={image} style={{ zIndex: 3 - index }} />
              ))}
            </div>
            <div className="custom-ranking-card-copy">
              <p>Top {ranking.playCount} · {ranking.itemCount} in the pool</p>
              <h2>{ranking.title}</h2>
              <span>by {ranking.creator}</span>
              {ranking.tags.length ? (
                <div className="custom-tag-row">
                  {ranking.tags.slice(0, 4).map((tag) => <em key={tag}>{tag}</em>)}
                </div>
              ) : null}
            </div>
          </Link>
        ))}
      </section>

      <footer className="blind-footer">Fresh order every play. Permanent choices every round.</footer>
    </main>
  );
}
