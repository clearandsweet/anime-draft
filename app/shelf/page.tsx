"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { readApiResponse } from "../lib/apiResponse";
import type { WorkResult } from "../lib/shelf/characters";
import { DEFAULT_SETTINGS, TIERS, type Tier, type TypeGroup } from "../lib/shelf/score";
import type { ShelfFigure, ShelfResult } from "../lib/shelf/shelf";
import CharacterRater, { type StoredRating } from "./CharacterRater";

type Service = "anilist" | "mal";
type Tab = "overall" | "value" | "shows" | "characters" | "method";
const RATINGS_KEY = "shelf-character-ratings";
type Shelf = ShelfResult & { service: Service; username: string; entryCount: number };

const TYPE_FILTERS: { id: TypeGroup; label: string }[] = [
  { id: "scale", label: "Scale" },
  { id: "articulated", label: "Nendoroid & figma" },
  { id: "nonscale", label: "Pop Up Parade class" },
  { id: "prize", label: "Prize" },
];
const SERVICE_NAMES: Record<Service, string> = { anilist: "AniList", mal: "MyAnimeList" };

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const one = (n: number) => n.toFixed(1);

export default function ShelfPage() {
  const [service, setService] = useState<Service>("anilist");
  const [username, setUsername] = useState("");
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overall");
  const [show, setShow] = useState("all");
  const [types, setTypes] = useState<Set<TypeGroup>>(new Set(TYPE_FILTERS.map((t) => t.id)));
  const [maxPrice, setMaxPrice] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [ratings, setRatings] = useState<Record<string, StoredRating>>({});
  const ratingsRef = useRef(ratings);

  async function load(nextService: Service, nextUser: string, rescoreOnly = false) {
    if (!rescoreOnly) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/shelf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: nextService,
          username: nextUser,
          ratings: Object.fromEntries(Object.entries(ratingsRef.current).map(([key, r]) => [key, r.rating])),
        }),
      });
      const data = await readApiResponse<Shelf & { error?: string }>(response);
      if (!response.ok || !data.figures) throw new Error(data.error || "The shelf could not be built.");
      setShelf(data);
      if (rescoreOnly) return;
      setShow("all");
      const params = new URLSearchParams({ service: nextService, user: nextUser });
      window.history.replaceState(null, "", `/shelf?${params}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The shelf could not be built.");
    } finally {
      if (!rescoreOnly) setLoading(false);
    }
  }

  // Ratings are saved in this browser; a shared link (/shelf?service=anilist&user=name) opens that shelf.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(RATINGS_KEY) || "{}");
      if (saved && typeof saved === "object") { ratingsRef.current = saved; setRatings(saved); }
    } catch {}
    const params = new URLSearchParams(window.location.search);
    const user = params.get("user");
    const fromLink: Service = params.get("service") === "mal" ? "mal" : "anilist";
    if (!user) return;
    setService(fromLink);
    setUsername(user);
    void load(fromLink, user);
  }, []);

  function rate(key: string, value: StoredRating | null) {
    const next = { ...ratingsRef.current };
    if (value) next[key] = value; else delete next[key];
    ratingsRef.current = next;
    setRatings(next);
    try { window.localStorage.setItem(RATINGS_KEY, JSON.stringify(next)); } catch {}
  }

  // Re-score the shelf a moment after ratings stop changing.
  const shelfOwner = shelf ? `${shelf.service}:${shelf.username}` : null;
  useEffect(() => {
    if (!shelfOwner) return;
    const [ownerService, ownerUser] = [shelfOwner.slice(0, shelfOwner.indexOf(":")) as Service, shelfOwner.slice(shelfOwner.indexOf(":") + 1)];
    const timer = window.setTimeout(() => void load(ownerService, ownerUser, true), 700);
    return () => window.clearTimeout(timer);
    // load is stable in behaviour; re-running only on rating or owner changes is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratings]);

  const quickPicks: WorkResult[] = useMemo(() => (shelf?.shows ?? [])
    .filter((s) => s.score > 0)
    .map((s) => ({ source: "anilist" as const, id: String(s.anchor), title: s.name, subtitle: "", image: null })), [shelf]);

  const shown = useMemo(() => {
    if (!shelf) return [];
    const allowed = new Set(Object.entries(TIERS).filter(([, t]) => types.has(t.group)).map(([tier]) => tier));
    const cap = Number(maxPrice) > 0 ? Number(maxPrice) : null;
    const rows = shelf.figures.filter((f) =>
      (show === "all" || f.show === show) &&
      allowed.has(f.tier) &&
      (!cap || (f.result.price !== null && f.result.price <= cap)) &&
      (tab !== "value" || f.result.value !== null));
    return tab === "value" ? [...rows].sort((a, b) => (b.result.value ?? 0) - (a.result.value ?? 0)) : rows;
  }, [shelf, show, types, maxPrice, tab]);

  const showName = (id: string) => shelf?.shows.find((s) => s.id === id)?.name ?? id;
  const picks = useMemo(() => {
    if (!shelf?.figures.length) return null;
    const value = shelf.figures.filter((f) => f.result.value !== null).sort((a, b) => (b.result.value ?? 0) - (a.result.value ?? 0))[0];
    const scale = shelf.figures.find((f) => (f.tier === "A" || f.tier === "B") && f.result.price !== null && f.result.price <= 100);
    return { overall: shelf.figures[0], value, scale };
  }, [shelf]);

  return (
    <main className="shelf-page">
      <nav className="shelf-nav">
        <Link href="/">Clear &amp; Sweet</Link>
        <span>Figure Shelf</span>
      </nav>

      <header className="shelf-hero">
        <p className="shelf-eyebrow">Anime figure picks</p>
        <h1>Figure Shelf</h1>
        <p className="shelf-lede">
          Ranks figures from the shows you&apos;ve watched by your own score for the show, the figure&apos;s
          quality, and how loved the character is. A franchise counts once, at your highest score for
          any entry that shares its characters.
        </p>
        <form
          className="shelf-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (username.trim()) void load(service, username.trim());
          }}
        >
          <div className="shelf-seg" role="radiogroup" aria-label="List site">
            {(Object.keys(SERVICE_NAMES) as Service[]).map((id) => (
              <button type="button" key={id} role="radio" aria-checked={service === id} onClick={() => setService(id)}>
                {SERVICE_NAMES[id]}
              </button>
            ))}
          </div>
          <label className="shelf-field">
            <span>{SERVICE_NAMES[service]} username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="clearandsweet" autoComplete="off" />
          </label>
          <button className="shelf-primary" type="submit" disabled={loading || !username.trim()}>
            {loading ? "Reading your list…" : "Build my shelf"}
          </button>
        </form>
        {error ? <p className="shelf-error" role="alert">{error}</p> : null}
      </header>

      {shelf ? (
        <>
          <div className="shelf-status">
            <span><b>{shelf.entryCount}</b> entries on {shelf.username}&apos;s {SERVICE_NAMES[shelf.service]}</span>
            <span><b>{shelf.shows.filter((s) => s.score > 0).length}</b> of {shelf.shows.length} shelf shows scored</span>
            <span><b>{shelf.figures.length}</b> figures</span>
            <span>Prices checked {shelf.pricesCheckedOn}</span>
          </div>

          {picks ? (
            <section className="shelf-picks" aria-label="Top picks">
              <Pick label="Top overall" figure={picks.overall} detail={(f) => `${showName(f.show)} · ${one(f.result.overall)}${f.result.price ? ` · ${money(f.result.price)}` : ""}`} />
              <Pick label="Top value" figure={picks.value} detail={(f) => `${money(f.result.price ?? 0)} ${f.cond ?? ""} · value ${one(f.result.value ?? 0)}`} />
              <Pick label="Best scale figure under $100" figure={picks.scale} detail={(f) => `${money(f.result.price ?? 0)} ${f.cond ?? ""} · ${one(f.result.overall)}`} />
            </section>
          ) : null}

          <div className="shelf-tabs" role="tablist">
            {([["overall", "Best overall"], ["value", "Best value"], ["shows", "Shows"], ["characters", "Rate characters"], ["method", "How it works"]] as [Tab, string][]).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>

          {tab === "overall" || tab === "value" ? (
            <>
              <div className="shelf-filters">
                <label className="shelf-field">
                  <span>Show</span>
                  <select value={show} onChange={(e) => setShow(e.target.value)}>
                    <option value="all">All shows</option>
                    {shelf.shows.filter((s) => s.score > 0 && shelf.figures.some((f) => f.show === s.id)).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
                <label className="shelf-field shelf-max">
                  <span>Max price (USD)</span>
                  <input type="number" min="0" step="10" inputMode="decimal" placeholder="Any" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
                </label>
                <div className="shelf-field">
                  <span>Type</span>
                  <div className="shelf-chips">
                    {TYPE_FILTERS.map((t) => (
                      <button
                        type="button"
                        key={t.id}
                        aria-pressed={types.has(t.id)}
                        onClick={() => setTypes((prev) => {
                          const next = new Set(prev);
                          if (next.has(t.id)) next.delete(t.id); else next.add(t.id);
                          return next;
                        })}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="shelf-count">
                {shown.length} figure{shown.length === 1 ? "" : "s"}
                {tab === "value" ? " · value = overall ÷ log₁₀ price; unpriced figures are left out" : ""}
              </p>
              <ol className="shelf-list">
                {shown.map((figure, index) => (
                  <FigureRow
                    key={figure.id}
                    figure={figure}
                    rank={index + 1}
                    mode={tab}
                    showName={showName(figure.show)}
                    open={open.has(figure.id)}
                    onToggle={() => setOpen((prev) => {
                      const next = new Set(prev);
                      if (next.has(figure.id)) next.delete(figure.id); else next.add(figure.id);
                      return next;
                    })}
                  />
                ))}
              </ol>
              {!shown.length ? <p className="shelf-empty">Nothing matches these filters. Widen the type filters or clear the max price.</p> : null}
            </>
          ) : null}

          {tab === "shows" ? (
            <ul className="shelf-shows">
              {shelf.shows.map((s) => (
                <li key={s.id} className={s.score > 0 ? "" : "is-unwatched"}>
                  <div>
                    <h3>{s.name}</h3>
                    <p>{s.basis}</p>
                  </div>
                  <b className="shelf-num">{s.score || "—"}</b>
                  <a href={s.anilistUrl} target="_blank" rel="noopener noreferrer">AniList ↗</a>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === "characters" ? <CharacterRater ratings={ratings} onRate={rate} quickPicks={quickPicks} /> : null}

          {tab === "method" ? <Method /> : null}
        </>
      ) : (
        <>
          <p className="shelf-empty">
            Enter a public AniList or MyAnimeList username to see figure picks from the 32 shows researched so far.
          </p>
          <CharacterRater ratings={ratings} onRate={rate} quickPicks={quickPicks} />
        </>
      )}
    </main>
  );
}

function Pick({ label, figure, detail }: { label: string; figure?: ShelfFigure; detail: (f: ShelfFigure) => string }) {
  if (!figure) return null;
  return (
    <div className="shelf-pick">
      <span>{label}</span>
      <strong>{figure.name}</strong>
      <em>{detail(figure)}</em>
    </div>
  );
}

function FigureRow({ figure, rank, mode, showName, open, onToggle }: {
  figure: ShelfFigure; rank: number; mode: Tab; showName: string; open: boolean; onToggle: () => void;
}) {
  const r = figure.result;
  const total = r.overall || 1;
  const tierLabel = TIERS[figure.tier as Tier].label;
  return (
    <li className="shelf-figure">
      <span className="shelf-rank">{rank}</span>
      <div className="shelf-body">
        <h3>{figure.name}</h3>
        <p>{showName} · {figure.charNames.join(" & ")}</p>
        <div className="shelf-tags">
          <span>{figure.line || tierLabel}</span>
          {r.realRating
            ? <span className="is-real">MFC {figure.mfcR?.toFixed(2)} · {figure.mfcN?.toLocaleString("en-US")} ratings</span>
            : <span className="is-est">Line estimate {r.prior.toFixed(1)}</span>}
          {figure.avail ? <span>{figure.avail}</span> : null}
        </div>
      </div>
      <div className="shelf-side">
        <div className="shelf-score">
          <b className="shelf-num">{one(mode === "value" ? r.value ?? 0 : r.overall)}</b>
          <span>{mode === "value" ? `value · overall ${one(r.overall)}` : "overall"}</span>
        </div>
        {r.price !== null
          ? <div className="shelf-tag">{money(r.price)}<small>{figure.cond}</small></div>
          : <div className="shelf-tag is-none">No price<small>hunt list</small></div>}
      </div>
      <button type="button" className="shelf-more" aria-expanded={open} onClick={onToggle}>
        {open ? "Hide breakdown" : "Breakdown"}
      </button>
      {open ? (
        <div className="shelf-detail">
          <div className="shelf-bar" role="img" aria-label={`Show ${one(r.parts.show)}, figure ${one(r.parts.quality)}, character ${one(r.parts.popularity)}`}>
            <i className="is-show" style={{ width: `${(100 * r.parts.show) / total}%` }} />
            <i className="is-quality" style={{ width: `${(100 * r.parts.quality) / total}%` }} />
            <i className="is-pop" style={{ width: `${(100 * r.parts.popularity) / total}%` }} />
          </div>
          <dl>
            <dt className="is-show">Show</dt>
            <dd>Your score {r.showScore} of 100</dd>
            <dd className="shelf-num">{one(r.parts.show)}</dd>
            <dt className="is-quality">Figure</dt>
            <dd>
              {r.realRating
                ? `MFC ${figure.mfcR?.toFixed(2)} from ${figure.mfcN} ratings, pulled toward the ${tierLabel.toLowerCase()} average ${r.prior.toFixed(1)} → ${r.quality.toFixed(2)}`
                : `No MFC rating yet, so it uses the ${tierLabel.toLowerCase()} average ${r.prior.toFixed(1)}`}
            </dd>
            <dd className="shelf-num">{one(r.parts.quality)}</dd>
            <dt className="is-pop">Character</dt>
            <dd>{r.popularity.how} → {r.popularity.value.toFixed(2)}</dd>
            <dd className="shelf-num">{one(r.parts.popularity)}</dd>
          </dl>
          {figure.note ? <p className="shelf-note">{figure.note}</p> : null}
          <div className="shelf-links">
            {figure.url && figure.url !== figure.mfcHref ? (
              <a href={figure.url} target="_blank" rel="noopener noreferrer">Source{figure.where ? `: ${figure.where}` : ""} ↗</a>
            ) : null}
            <a href={figure.mfcHref} target="_blank" rel="noopener noreferrer">
              {figure.mfcDirect ? "Open on MyFigureCollection ↗" : "Search MyFigureCollection ↗"}
            </a>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function Method() {
  const s = DEFAULT_SETTINGS;
  const total = s.wShow + s.wQuality + s.wPop;
  const pct = (w: number) => `${Math.round((100 * w) / total)}%`;
  return (
    <section className="shelf-method">
      <h2>How a figure is scored</h2>
      <p>
        Three parts, each scaled 0 to 1: your score for the show ({pct(s.wShow)}), the figure&apos;s quality
        ({pct(s.wQuality)}), and how loved the character is ({pct(s.wPop)}).
      </p>
      <ul>
        <li><b>Your show score</b> is your highest score for any entry in the franchise. A franchise is every entry with the same characters: seasons, films and remakes count together, while a spin-off with a new cast, or each Precure series, stands alone.</li>
        <li><b>Figure quality</b> is the MyFigureCollection rating, pulled toward the average for its kind of figure when few people have rated it (C = {s.C} ratings). Figures without a rating use that average.</li>
        <li><b>Character</b> is √(the character&apos;s AniList favourites ÷ the franchise&apos;s most-favourited character). Characters you&apos;ve favourited on AniList count fully, and a character you rate under Rate characters uses your rating instead (10 counts fully, 5 counts half).</li>
        <li><b>Value</b> divides the overall score by log₁₀ of the price, so a $40 figure isn&apos;t automatically ahead of a $130 one.</li>
        <li><b>Prices</b> are the lowest listing found when the shelf was researched, mostly from Solaris Japan. Buy from established Japan-based shops; older figma and Nendoroids are common bootleg targets.</li>
      </ul>
    </section>
  );
}
