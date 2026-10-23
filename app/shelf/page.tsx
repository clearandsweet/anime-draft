"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { readApiResponse } from "../lib/apiResponse";
import type { WorkResult } from "../lib/shelf/characters";
import { shopSearches } from "../lib/shelf/links";
import { DEFAULT_SETTINGS, TIERS, type Tier, type TypeGroup } from "../lib/shelf/score";
import { scoreShelf } from "../lib/shelf/shelf";
import type { ScoredFigure, ShelfFigure, ShelfShow } from "../lib/shelf/types";
import CharacterRater, { type StoredRating } from "./CharacterRater";

type Service = "anilist" | "mal";
type Tab = "picks" | "shows" | "characters" | "method";
type Sort = "overall" | "value";
type Shelf = {
  service: Service;
  username: string;
  entryCount: number;
  unmatched: number;
  favouriteCharacters: number[];
  catalogDate: string;
  liveSearch: string | null;
  shows: ShelfShow[];
  figures: ShelfFigure[];
  /** Every figure matched to the list; the best of each show's are in `figures`. */
  matched: number;
};
type LiveState = { done: Record<string, number | "error">; pending: string[] };

const RATINGS_KEY = "shelf-character-ratings";
const PAGE = 60;
// Live (eBay) search covers the best-scored shows straight away; the rest wait for a click.
const LIVE_FIRST = 60;
const LIVE_BATCH = 6;
const LIVE_WORKERS = 2;
const TYPE_FILTERS: { id: TypeGroup; label: string }[] = [
  { id: "scale", label: "Scale" },
  { id: "articulated", label: "Nendoroid & figma" },
  { id: "nonscale", label: "Pop Up Parade class" },
  { id: "prize", label: "Prize" },
];
const SERVICE_NAMES: Record<Service, string> = { anilist: "AniList", mal: "MyAnimeList" };
const TABS: [Tab, string][] = [["picks", "Picks"], ["shows", "Shows"], ["characters", "Rate characters"], ["method", "How it works"]];

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const one = (n: number) => n.toFixed(1);
const plural = (n: number, word: string) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

export default function ShelfPage() {
  const [service, setService] = useState<Service>("anilist");
  const [username, setUsername] = useState("");
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("picks");
  const [sort, setSort] = useState<Sort>("overall");
  const [show, setShow] = useState("all");
  const [types, setTypes] = useState<Set<TypeGroup>>(new Set(TYPE_FILTERS.map((t) => t.id)));
  const [maxPrice, setMaxPrice] = useState("");
  const [buyable, setBuyable] = useState(true);
  const [hideAdult, setHideAdult] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [ratings, setRatings] = useState<Record<string, StoredRating>>({});
  const ratingsRef = useRef(ratings);
  const [live, setLive] = useState<ShelfFigure[]>([]);
  const [liveState, setLiveState] = useState<LiveState>({ done: {}, pending: [] });
  const generation = useRef(0);

  async function load(nextService: Service, nextUser: string) {
    const run = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/shelf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Ratings help the server pick which of a big franchise's figures to send.
        body: JSON.stringify({ service: nextService, username: nextUser, ratings: Object.fromEntries(Object.entries(ratingsRef.current).map(([key, r]) => [key, r.rating])) }),
      });
      const data = await readApiResponse<Shelf & { error?: string }>(response);
      if (!response.ok || !data.shows) throw new Error(data.error || "The shelf could not be built.");
      if (run !== generation.current) return;
      setShelf(data);
      setLive([]);
      setLiveState({ done: {}, pending: [] });
      setShow("all");
      setLimit(PAGE);
      setTab("picks");
      window.history.replaceState(null, "", `/shelf?${new URLSearchParams({ service: nextService, user: nextUser })}`);
      if (data.liveSearch) void searchLive(data, data.shows.filter((s) => s.score > 0).slice(0, LIVE_FIRST).map((s) => s.id), run);
    } catch (caught) {
      if (run === generation.current) setError(caught instanceof Error ? caught.message : "The shelf could not be built.");
    } finally {
      if (run === generation.current) setLoading(false);
    }
  }

  /** Asks the live search for a few shows at a time, best scored first, adding figures as they come. */
  async function searchLive(source: Shelf, ids: string[], run = generation.current) {
    const byId = new Map(source.shows.map((s) => [s.id, s]));
    const queue = ids.filter((id) => byId.has(id));
    if (!queue.length) return;
    setLiveState((prev) => ({ ...prev, pending: [...new Set([...prev.pending, ...queue])] }));
    const worker = async () => {
      while (queue.length && run === generation.current) {
        const batch = queue.splice(0, LIVE_BATCH).map((id) => byId.get(id)!);
        let results: Record<string, number | "error">;
        try {
          const response = await fetch("/api/shelf/figures", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shows: batch.map(({ id, score, terms, cast }) => ({ id, score, terms, cast })) }),
          });
          const data = await readApiResponse<{ figures?: ShelfFigure[]; searched?: { id: string; found: number; error?: string }[]; error?: string }>(response);
          if (!response.ok || !data.figures) throw new Error(data.error || "Search failed.");
          if (run !== generation.current) return;
          setLive((prev) => [...prev, ...data.figures!]);
          results = Object.fromEntries((data.searched ?? []).map((s) => [s.id, s.error ? "error" : s.found]));
        } catch {
          results = Object.fromEntries(batch.map((s) => [s.id, "error" as const]));
        }
        if (run !== generation.current) return;
        setLiveState((prev) => ({
          done: { ...prev.done, ...results },
          pending: prev.pending.filter((id) => !(id in results)),
        }));
      }
    };
    await Promise.all(Array.from({ length: LIVE_WORKERS }, worker));
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
    // Runs once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function rate(key: string, value: StoredRating | null) {
    const next = { ...ratingsRef.current };
    if (value) next[key] = value; else delete next[key];
    ratingsRef.current = next;
    setRatings(next);
    try { window.localStorage.setItem(RATINGS_KEY, JSON.stringify(next)); } catch {}
  }

  const showsById = useMemo(() => new Map((shelf?.shows ?? []).map((s) => [s.id, s])), [shelf]);

  // Scored here, so a new character rating re-ranks everything at once.
  const scored = useMemo(() => shelf ? scoreShelf({
    shows: shelf.shows,
    figures: [...shelf.figures, ...live],
    favouriteCharacters: shelf.favouriteCharacters,
    ratings: Object.fromEntries(Object.entries(ratings).map(([key, r]) => [key, r.rating])),
  }) : [], [shelf, live, ratings]);

  const figureCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const figure of scored) counts.set(figure.show, (counts.get(figure.show) ?? 0) + 1);
    return counts;
  }, [scored]);

  const eligible = useMemo(() => scored.filter((f) => (!buyable || f.avail !== "sold out") && (!hideAdult || !f.nsfw)), [scored, buyable, hideAdult]);

  const shown = useMemo(() => {
    const allowed = new Set(Object.entries(TIERS).filter(([, t]) => types.has(t.group)).map(([tier]) => tier));
    const cap = Number(maxPrice) > 0 ? Number(maxPrice) : null;
    const rows = eligible.filter((f) =>
      (show === "all" || f.show === show) &&
      allowed.has(f.tier) &&
      (!cap || (f.result.price !== null && f.result.price <= cap)) &&
      (sort !== "value" || f.result.value !== null));
    return sort === "value" ? [...rows].sort((a, b) => (b.result.value ?? 0) - (a.result.value ?? 0)) : rows;
  }, [eligible, show, types, maxPrice, sort]);

  const picks = useMemo(() => {
    if (!eligible.length) return null;
    const value = eligible.filter((f) => f.result.value !== null).sort((a, b) => (b.result.value ?? 0) - (a.result.value ?? 0))[0];
    const scale = eligible.find((f) => (f.tier === "A" || f.tier === "B") && f.result.price !== null && f.result.price <= 100);
    return { overall: eligible[0], value, scale };
  }, [eligible]);

  const quickPicks: WorkResult[] = useMemo(() => (shelf?.shows ?? [])
    .filter((s) => s.score > 0)
    .slice(0, 12)
    .map((s) => ({ source: "anilist" as const, id: String(s.entries[0].id), title: s.name, subtitle: "", image: s.image })), [shelf]);

  const scoredShows = shelf?.shows.filter((s) => s.score > 0) ?? [];
  const liveLeft = shelf?.liveSearch ? scoredShows.filter((s) => !(s.id in liveState.done) && !liveState.pending.includes(s.id)) : [];
  const liveDone = Object.keys(liveState.done).length;

  const toggle = (id: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <main className="shelf-page">
      <nav className="shelf-nav">
        <Link href="/">Clear &amp; Sweet</Link>
        <span>Figure Shelf</span>
      </nav>

      <header className="shelf-hero">
        <p className="shelf-eyebrow">Figure picks from your own list</p>
        <h1>Figure Shelf</h1>
        <p className="shelf-lede">
          Every show on your AniList or MyAnimeList, scored by you, matched against thousands of figures. Each
          franchise counts once, at your highest score for any entry that shares its characters.
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
            {loading ? "Reading your whole list…" : "Build my shelf"}
          </button>
        </form>
        {error ? <p className="shelf-error" role="alert">{error}</p> : null}
      </header>

      {shelf ? (
        <>
          <div className="shelf-status">
            <span><b>{shelf.entryCount.toLocaleString("en-US")}</b> entries on {shelf.username}&apos;s {SERVICE_NAMES[shelf.service]}</span>
            <span><b>{shelf.shows.length.toLocaleString("en-US")}</b> franchises, {scoredShows.length.toLocaleString("en-US")} scored</span>
            <span><b>{shelf.matched.toLocaleString("en-US")}</b> figures matched, best {scored.length.toLocaleString("en-US")} loaded</span>
            <span>Catalog checked {shelf.catalogDate}</span>
            {shelf.liveSearch ? (
              <span>
                {liveState.pending.length
                  ? <>Searching {shelf.liveSearch}: <b>{liveDone}</b> of {liveDone + liveState.pending.length} shows</>
                  : <>{shelf.liveSearch}: <b>{liveDone}</b> shows searched</>}
              </span>
            ) : null}
            {shelf.unmatched ? <span>{plural(shelf.unmatched, "title")} not found on AniList</span> : null}
          </div>

          {picks ? (
            <section className="shelf-picks" aria-label="Top picks">
              <Spotlight label="Top overall" figure={picks.overall} show={showsById.get(picks.overall.show)} stat={`${one(picks.overall.result.overall)} overall`} />
              <Spotlight label="Best value" figure={picks.value} show={picks.value && showsById.get(picks.value.show)} stat={picks.value ? `value ${one(picks.value.result.value ?? 0)}` : ""} />
              <Spotlight label="Best scale figure under $100" figure={picks.scale} show={picks.scale && showsById.get(picks.scale.show)} stat={picks.scale ? `${one(picks.scale.result.overall)} overall` : ""} />
            </section>
          ) : null}

          <div className="shelf-tabs" role="tablist">
            {TABS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>

          {tab === "picks" ? (
            <>
              <div className="shelf-filters">
                <div className="shelf-seg" role="radiogroup" aria-label="Rank by">
                  {([["overall", "Best overall"], ["value", "Best value"]] as [Sort, string][]).map(([id, label]) => (
                    <button type="button" key={id} role="radio" aria-checked={sort === id} onClick={() => { setSort(id); setLimit(PAGE); }}>{label}</button>
                  ))}
                </div>
                <label className="shelf-field shelf-show-pick">
                  <span>Show</span>
                  <select value={show} onChange={(e) => { setShow(e.target.value); setLimit(PAGE); }}>
                    <option value="all">All shows</option>
                    {shelf.shows.filter((s) => s.score > 0 && figureCount.get(s.id)).map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({figureCount.get(s.id)})</option>
                    ))}
                  </select>
                </label>
                <label className="shelf-field shelf-max">
                  <span>Max price (USD)</span>
                  <input type="number" min="0" step="10" inputMode="decimal" placeholder="Any" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setLimit(PAGE); }} />
                </label>
                <div className="shelf-field shelf-types">
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
                <div className="shelf-field">
                  <span>Show only</span>
                  <div className="shelf-chips">
                    <button type="button" aria-pressed={buyable} onClick={() => setBuyable((v) => !v)}>For sale now</button>
                    <button type="button" aria-pressed={hideAdult} onClick={() => setHideAdult((v) => !v)}>Hide 18+</button>
                  </div>
                </div>
              </div>
              <p className="shelf-count">
                {plural(shown.length, "figure")}
                {show !== "all" ? <> from {showsById.get(show)?.name} · <button type="button" className="shelf-link" onClick={() => setShow("all")}>all shows</button></> : null}
                {sort === "value" ? " · value = overall ÷ log₁₀ price" : ""}
              </p>
              <ol className="shelf-grid">
                {shown.slice(0, limit).map((figure, index) => (
                  <FigureCard
                    key={figure.id}
                    figure={figure}
                    rank={index + 1}
                    sort={sort}
                    show={showsById.get(figure.show)}
                    open={open.has(figure.id)}
                    onToggle={() => toggle(figure.id)}
                  />
                ))}
              </ol>
              {shown.length > limit ? (
                <button type="button" className="shelf-more" onClick={() => setLimit((n) => n + PAGE)}>
                  Show {Math.min(PAGE, shown.length - limit)} more of {shown.length - limit}
                </button>
              ) : null}
              {!shown.length ? (
                <p className="shelf-empty">
                  Nothing matches these filters. Widen the types, clear the max price, or turn off “For sale now” to see sold-out figures too.
                </p>
              ) : null}
              {liveLeft.length ? <LiveMore count={liveLeft.length} name={shelf.liveSearch!} onClick={() => void searchLive(shelf, liveLeft.map((s) => s.id))} /> : null}
            </>
          ) : null}

          {tab === "shows" ? (
            <ShowList
              shows={shelf.shows}
              counts={figureCount}
              liveName={shelf.liveSearch}
              liveState={liveState}
              onPicks={(id) => { setShow(id); setLimit(PAGE); setTab("picks"); }}
              onSearch={(id) => void searchLive(shelf, [id])}
            />
          ) : null}

          {tab === "characters" ? <CharacterRater ratings={ratings} onRate={rate} quickPicks={quickPicks} /> : null}

          {tab === "method" ? <Method liveName={shelf.liveSearch} /> : null}
        </>
      ) : (
        <>
          <ul className="shelf-intro">
            <li><b>Your whole list</b> Every entry and score, grouped into franchises by shared characters.</li>
            <li><b>Real listings</b> Solaris Japan&apos;s catalog of new and pre-owned figures, with photos and prices.</li>
            <li><b>Your characters</b> AniList favourites count fully, and you can rate any character below.</li>
          </ul>
          <CharacterRater ratings={ratings} onRate={rate} quickPicks={quickPicks} />
        </>
      )}
    </main>
  );
}

function Thumb({ figure }: { figure: ShelfFigure }) {
  return figure.img ? (
    // Product photos come straight from the shop's CDN.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={figure.img} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
  ) : <span className="shelf-thumb-blank" aria-hidden="true">{figure.line}</span>;
}

function Spotlight({ label, figure, show, stat }: { label: string; figure?: ScoredFigure; show?: ShelfShow; stat: string }) {
  if (!figure) return null;
  return (
    <a className="shelf-spot" href={figure.url} target="_blank" rel="noopener noreferrer">
      <span className="shelf-spot-media"><Thumb figure={figure} /></span>
      <span className="shelf-spot-body">
        <span className="shelf-spot-label">{label}</span>
        <strong>{figure.name}</strong>
        <em>{show?.name} · {stat}{figure.result.price !== null ? ` · ${money(figure.result.price)}` : ""}</em>
      </span>
    </a>
  );
}

function FigureCard({ figure, rank, sort, show, open, onToggle }: {
  figure: ScoredFigure; rank: number; sort: Sort; show?: ShelfShow; open: boolean; onToggle: () => void;
}) {
  const r = figure.result;
  const total = r.overall || 1;
  const tierLabel = TIERS[figure.tier as Tier].label;
  return (
    <li className={`shelf-card${open ? " is-open" : ""}`}>
      <div className="shelf-card-media">
        <Thumb figure={figure} />
        <span className="shelf-rank">{rank}</span>
        <span className="shelf-card-score">
          <b className="shelf-num">{one(sort === "value" ? r.value ?? 0 : r.overall)}</b>
          {sort === "value" ? "value" : "score"}
        </span>
      </div>
      <div className="shelf-card-body">
        <p className="shelf-card-show">{show?.name}</p>
        <h3>{figure.name}</h3>
        <p className="shelf-card-chars">{figure.charNames.join(" & ") || "Character not matched"}</p>
        <div className="shelf-tags">
          <span>{figure.line}</span>
          {r.realRating ? <span className="is-real">MFC {figure.mfcR?.toFixed(2)}</span> : null}
          <span className={`is-${figure.avail.replace(" ", "-")}`}>{figure.avail}</span>
          {figure.cond === "pre-owned" ? <span>pre-owned</span> : null}
        </div>
        <div className="shelf-card-buy">
          {r.price !== null ? (
            <span className="shelf-price shelf-num">{money(r.price)}{figure.priceLabel ? <small>{figure.priceLabel}</small> : null}</span>
          ) : <span className="shelf-price is-none">No price</span>}
          <a href={figure.url} target="_blank" rel="noopener noreferrer">{figure.source} ↗</a>
        </div>
        <div className="shelf-card-links">
          <a href={figure.mfcHref} target="_blank" rel="noopener noreferrer">{figure.mfcDirect ? "MFC page ↗" : "Find on MFC ↗"}</a>
          <button type="button" aria-expanded={open} onClick={onToggle}>{open ? "Hide score" : "Why this score"}</button>
        </div>
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
                  ? `MFC ${figure.mfcR?.toFixed(2)} from ${figure.mfcN} ratings, pulled toward the ${tierLabel.toLowerCase()} average ${r.prior.toFixed(1)}`
                  : `${tierLabel} average ${r.prior.toFixed(1)} (no MFC rating on file)`}
              </dd>
              <dd className="shelf-num">{one(r.parts.quality)}</dd>
              <dt className="is-pop">Character</dt>
              <dd>{r.popularity.how} → {r.popularity.value.toFixed(2)}</dd>
              <dd className="shelf-num">{one(r.parts.popularity)}</dd>
            </dl>
            {figure.note ? <p className="shelf-note">{figure.note}</p> : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function LiveMore({ count, name, onClick }: { count: number; name: string; onClick: () => void }) {
  return (
    <div className="shelf-live-more">
      <p>{plural(count, "scored show")} not searched on {name} yet.</p>
      <button type="button" className="shelf-primary" onClick={onClick}>Search {name} for them</button>
    </div>
  );
}

function ShowList({ shows, counts, liveName, liveState, onPicks, onSearch }: {
  shows: ShelfShow[];
  counts: Map<string, number>;
  liveName: string | null;
  liveState: LiveState;
  onPicks: (id: string) => void;
  onSearch: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const q = query.trim().toLowerCase();
  const rows = shows.filter((s) =>
    (!q || s.name.toLowerCase().includes(q) || s.entries.some((e) => e.title.toLowerCase().includes(q))) &&
    (!onlyEmpty || !counts.get(s.id)));
  return (
    <section aria-label="Your shows">
      <div className="shelf-filters">
        <label className="shelf-field shelf-show-pick">
          <span>Find a show</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sound of the Sky" autoComplete="off" />
        </label>
        <div className="shelf-field">
          <span>Show only</span>
          <div className="shelf-chips">
            <button type="button" aria-pressed={onlyEmpty} onClick={() => setOnlyEmpty((v) => !v)}>No figures found yet</button>
          </div>
        </div>
      </div>
      <p className="shelf-count">
        {plural(rows.length, "franchise")} · shows without catalog figures still get a search on every shop
      </p>
      <ul className="shelf-shows">
        {rows.map((s) => {
          const count = counts.get(s.id) ?? 0;
          const status = liveState.done[s.id];
          return (
            <li key={s.id} className={s.score > 0 ? "" : "is-unscored"}>
              {s.image ? (
                // Cover art from AniList's CDN.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image} alt="" loading="lazy" />
              ) : <span className="shelf-shows-blank" aria-hidden="true" />}
              <div className="shelf-shows-body">
                <h3><a href={s.anilistUrl} target="_blank" rel="noopener noreferrer">{s.name}</a></h3>
                <p>{s.basis}</p>
                <div className="shelf-shows-links">
                  {shopSearches(s.name).map((shop) => (
                    <a key={shop.label} href={shop.href} target="_blank" rel="noopener noreferrer">{shop.label} ↗</a>
                  ))}
                </div>
              </div>
              <div className="shelf-shows-side">
                <b className="shelf-num">{s.score || "—"}</b>
                <span>{plural(count, "figure")}</span>
                {count && s.score > 0 ? <button type="button" onClick={() => onPicks(s.id)}>See picks</button> : null}
                {liveName && s.score > 0 ? (
                  status === undefined
                    ? liveState.pending.includes(s.id)
                      ? <em>Searching {liveName}…</em>
                      : <button type="button" onClick={() => onSearch(s.id)}>Search {liveName}</button>
                    : <em>{status === "error" ? `${liveName} failed` : `${liveName}: ${status}`}</em>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Method({ liveName }: { liveName: string | null }) {
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
        <li><b>Your show score</b> is your highest score for any entry in the franchise. A franchise is every entry with the same characters: seasons, films and remakes count together, while a spin-off with a new cast, or each Precure series, stands alone. Unscored shows are listed under Shows but get no picks.</li>
        <li><b>Figure quality</b> is the MyFigureCollection rating where the shelf has one, pulled toward the average for its kind of figure (scale, Nendoroid, Pop Up Parade, prize) when few people have rated it. Other figures use that average.</li>
        <li><b>Character</b> is √(the character&apos;s AniList favourites ÷ the franchise&apos;s most-favourited character). Your AniList favourites count fully, and a character you rate under Rate characters uses your rating instead (10 counts fully, 5 counts half).</li>
        <li><b>Value</b> divides the overall score by log₁₀ of the price, so a $40 figure isn&apos;t automatically ahead of a $130 one.</li>
      </ul>
      <h2>Where the figures come from</h2>
      <ul>
        <li><b>Solaris Japan</b>: its catalog of new and pre-owned figures, matched to your shows by series and character. Prices are in US dollars, before shipping, as of the catalog date.</li>
        <li><b>Researched picks</b> from the original shelf, with real MyFigureCollection ratings.</li>
        {liveName ? <li><b>{liveName}</b>: live buy-it-now listings for your best-scored shows, searched as the page loads. Obvious knock-offs are dropped, but check the seller before buying.</li> : null}
        <li><b>MyFigureCollection</b> has no public API, so every figure links to its MFC page or an MFC search instead.</li>
        <li>Older and rarer figures are mostly on the secondhand market: every show under Shows links to searches on MFC, eBay, Mandarake, AmiAmi and Solaris.</li>
      </ul>
    </section>
  );
}
