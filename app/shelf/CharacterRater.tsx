"use client";

import { useEffect, useState } from "react";
import { readApiResponse } from "../lib/apiResponse";
import { RATING_MAX, RATING_MIN, type CharacterResult, type WorkResult } from "../lib/shelf/characters";

export type StoredRating = { rating: number; name: string; image: string | null; work: string };
type Character = CharacterResult & { figures: number };
type Kind = "show" | "game";

const SCALE = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i);

export default function CharacterRater({ ratings, onRate, quickPicks }: {
  ratings: Record<string, StoredRating>;
  onRate: (key: string, value: StoredRating | null) => void;
  quickPicks: WorkResult[];
}) {
  const [kind, setKind] = useState<Kind>("show");
  const [query, setQuery] = useState("");
  const [works, setWorks] = useState<WorkResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [work, setWork] = useState<WorkResult | null>(null);
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const q = query.trim();
      if (q.length < 2) { setWorks([]); return; }
      setSearching(true);
      setError("");
      try {
        const response = await fetch(`/api/shelf/characters?kind=${kind}&q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = await readApiResponse<{ works?: WorkResult[]; error?: string }>(response);
        if (!response.ok || !data.works) throw new Error(data.error || "Search failed.");
        setWorks(data.works);
      } catch (caught) {
        if ((caught as Error).name !== "AbortError") setError(caught instanceof Error ? caught.message : "Search failed.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, kind]);

  async function pick(next: WorkResult) {
    setWork(next);
    setCharacters(null);
    setLoadingCharacters(true);
    setError("");
    try {
      const response = await fetch(`/api/shelf/characters?source=${next.source}&id=${encodeURIComponent(next.id)}`);
      const data = await readApiResponse<{ characters?: Character[]; error?: string }>(response);
      if (!response.ok || !data.characters) throw new Error(data.error || "Characters could not be loaded.");
      setCharacters(data.characters);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Characters could not be loaded.");
    } finally {
      setLoadingCharacters(false);
    }
  }

  const rated = Object.entries(ratings).sort((a, b) => b[1].rating - a[1].rating || a[1].name.localeCompare(b[1].name));

  return (
    <section className="shelf-rater" aria-label="Rate characters">
      <h2>Rate characters</h2>
      <p className="shelf-count">
        Pick a show or game to see its five most popular characters. Your rating replaces popularity in figure
        scores: a 10 counts fully, a 5 counts half. Ratings stay in this browser.
      </p>

      <div className="shelf-rater-search">
        <div className="shelf-seg" role="radiogroup" aria-label="Look up">
          {(["show", "game"] as Kind[]).map((id) => (
            <button type="button" key={id} role="radio" aria-checked={kind === id} onClick={() => { setKind(id); setWorks([]); }}>
              {id === "show" ? "Show" : "Game"}
            </button>
          ))}
        </div>
        <label className="shelf-field">
          <span>{kind === "show" ? "Find a show" : "Find a game"}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={kind === "show" ? "Madoka, Frieren, Spice and Wolf…" : "Elden Ring, NieR: Automata, Touhou…"}
            autoComplete="off"
          />
        </label>
      </div>

      {kind === "show" && quickPicks.length && !query.trim() ? (
        <div className="shelf-chips shelf-quick" aria-label="Your shows">
          {quickPicks.map((w) => (
            <button type="button" key={w.id} aria-pressed={work?.source === w.source && work.id === w.id} onClick={() => void pick(w)}>
              {w.title}
            </button>
          ))}
        </div>
      ) : null}

      {searching ? <p className="shelf-count">Searching…</p> : null}
      {works.length ? (
        <ul className="shelf-works">
          {works.map((w) => (
            <li key={`${w.source}:${w.id}`}>
              <button type="button" aria-pressed={work?.source === w.source && work.id === w.id} onClick={() => void pick(w)}>
                {w.image ? (
                  // Cover art comes straight from AniList's CDN.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.image} alt="" />
                ) : <span className="shelf-works-blank" aria-hidden="true" />}
                <span><b>{w.title}</b><em>{w.subtitle}</em></span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="shelf-error" role="alert">{error}</p> : null}

      {work ? (
        <div className="shelf-cast">
          <h3>{work.title}</h3>
          {loadingCharacters ? <p className="shelf-count">Loading characters…</p> : null}
          {characters && !characters.length ? (
            <p className="shelf-empty">No characters are listed for this {kind === "game" ? "game" : "show"} yet.</p>
          ) : null}
          <ol>
            {(characters ?? []).map((c) => {
              const current = ratings[c.key]?.rating ?? null;
              return (
                <li key={c.key}>
                  {c.image ? (
                    // Character art from AniList or Wikimedia Commons.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image} alt="" />
                  ) : <span className="shelf-cast-initial" aria-hidden="true">{c.name.slice(0, 1)}</span>}
                  <div className="shelf-cast-body">
                    <a href={c.url} target="_blank" rel="noopener noreferrer"><b>{c.name}</b></a>
                    <span>{c.popularityLabel}{c.figures ? ` · ${c.figures} figure${c.figures === 1 ? "" : "s"} on the shelf` : ""}</span>
                    <div className="shelf-stars" role="radiogroup" aria-label={`Your rating for ${c.name}`}>
                      {SCALE.map((n) => (
                        <button
                          type="button"
                          key={n}
                          role="radio"
                          aria-checked={current === n}
                          className={current !== null && n <= current ? "is-on" : ""}
                          onClick={() => onRate(c.key, { rating: n, name: c.name, image: c.image, work: work.title })}
                        >
                          {n}
                        </button>
                      ))}
                      {current !== null ? (
                        <button type="button" className="shelf-clear" onClick={() => onRate(c.key, null)}>Clear</button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {rated.length ? (
        <div className="shelf-rated">
          <h3>Your ratings</h3>
          <ul>
            {rated.map(([key, r]) => (
              <li key={key}>
                <b className="shelf-num">{r.rating}</b>
                <span>{r.name}<em>{r.work}</em></span>
                <button type="button" aria-label={`Remove rating for ${r.name}`} onClick={() => onRate(key, null)}>×</button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
