"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CARDS, SETS, type CnCard, type Line } from "../lib/chinaBinder/cards";
import type { Direction, Sale, Trend } from "../lib/chinaBinder/market";
import type { CardMarket, MarketResponse } from "../api/pokemon-cn-binder/data";

const LINES: ("All" | Line)[] = ["All", "Gem Packs", "151", "Main sets"];
const FILTER_KEY = "cnbinder-filter";
const ARROW: Record<Direction, string> = { up: "▲", down: "▼", flat: "▬", none: "" };
const RARITY_NAME = { AR: "Art Rare", IR: "Illustration Rare", SAR: "Special Art Rare", SIR: "Special Illustration Rare" } as const;

const usd = (value: number | null | undefined) =>
  value == null ? "—" : value >= 1000 ? `$${Math.round(value).toLocaleString("en-US")}` : `$${value.toFixed(value >= 100 ? 0 : 2)}`;

const ebaySold = (card: CnCard) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(card.q)}&LH_Sold=1&LH_Complete=1&LH_PrefLoc=1`;
const ebayLive = (card: CnCard) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(card.q)}&LH_PrefLoc=1`;

type Headline = { price: string; basis: string; detail: string; live: boolean };

/** The one price a pocket shows: PriceCharting's raw sold price, then PSA 10, then eBay asking, then the researched figure. */
function headline(card: CnCard, market: CardMarket | undefined): Headline | null {
  if (market?.pc?.ungraded) return { price: usd(market.pc.ungraded), basis: "raw · sold", detail: "PriceCharting's current price for an ungraded copy, built from eBay sales.", live: true };
  if (market?.pc?.psa10) return { price: usd(market.pc.psa10), basis: "PSA 10 · sold", detail: "PriceCharting's current PSA 10 price, built from eBay sales. Not enough ungraded sales yet.", live: true };
  if (market?.ask) return { price: usd(market.ask.median), basis: "ask · median", detail: `Median Buy It Now price across ${market.ask.count} live eBay US listings.`, live: true };
  if (card.seed) return { price: card.seed.price, basis: card.seed.basis, detail: "Researched by hand on 25 Nov 2026.", live: false };
  return null;
}

function trendWords(trend: Trend) {
  if (trend.pct === null) return "No 14-day move yet";
  if (trend.dir === "flat") return "Flat · 14 days";
  return `${trend.pct > 0 ? "+" : "−"}${Math.abs(trend.pct).toFixed(1)}% · 14 days`;
}

function trendExplanation(trend: Trend) {
  const what = trend.grade === "psa10" ? "PSA 10 copies" : "ungraded copies";
  if (trend.basis === "sold" && trend.pct !== null)
    return (
      <>
        Median eBay sale of {what}: <b>{usd(trend.now)}</b> over the last 14 days ({trend.nNow} sale{trend.nNow === 1 ? "" : "s"}), against <b>{usd(trend.before)}</b> in the 14 days before ({trend.nBefore} sale{trend.nBefore === 1 ? "" : "s"}). Sales recorded by PriceCharting.
      </>
    );
  if (trend.basis === "tracked" && trend.pct !== null)
    return (
      <>
        PriceCharting&apos;s raw price is <b>{usd(trend.now)}</b> today, against <b>{usd(trend.before)}</b> when this page checked about two weeks ago.
      </>
    );
  if (trend.basis === "asking" && trend.pct !== null)
    return (
      <>
        Median eBay asking price is <b>{usd(trend.now)}</b> today, against <b>{usd(trend.before)}</b> about two weeks ago.
      </>
    );
  return <>There haven&apos;t been at least two sales in each of the last two 14-day windows. The page also records prices daily, so a trend appears once two weeks of readings exist.</>;
}

function SalesChart({ sales, today, label }: { sales: Sale[]; today: string; label: string }) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const W = 320, H = 132, L = 44, R = 8, T = 10, B = 22, DAYS = 60;
  const end = Date.parse(`${today}T00:00:00Z`);
  const points = sales.map((s) => ({ ...s, age: Math.round((end - Date.parse(`${s.date}T00:00:00Z`)) / 86_400_000) }));
  if (points.length < 2) return <p>Too few sales in the last 60 days to chart.</p>;
  const prices = points.map((p) => p.price);
  let lo = Math.min(...prices), hi = Math.max(...prices);
  if (hi - lo < hi * 0.1) { lo = lo * 0.92; hi = hi * 1.08; }
  const pad = (hi - lo) * 0.08;
  lo = Math.max(0, lo - pad); hi = hi + pad;
  const x = (age: number) => L + ((DAYS - age) / DAYS) * (W - L - R);
  const y = (price: number) => T + (1 - (price - lo) / (hi - lo)) * (H - T - B);
  const ticks = [lo, (lo + hi) / 2, hi];
  const windowMedian = (from: number, to: number) => {
    const inWin = points.filter((p) => p.age >= from && p.age < to).map((p) => p.price).sort((a, b) => a - b);
    if (!inWin.length) return null;
    const m = Math.floor(inWin.length / 2);
    return inWin.length % 2 ? inWin[m] : (inWin[m - 1] + inWin[m]) / 2;
  };
  const recent = windowMedian(0, 14);
  const prior = windowMedian(14, 28);
  return (
    <div className="cnb-chart">
      <div className="cnb-chart-title">{label} · last 60 days</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${points.length} sales in the last 60 days, from ${usd(Math.min(...prices))} to ${usd(Math.max(...prices))}.`} onMouseLeave={() => setTip(null)}>
        <rect x={x(14)} y={T} width={x(0) - x(14)} height={H - T - B} fill="var(--chart-band)" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={L - 6} y={y(t) + 3.5} textAnchor="end" fontSize={9.5} fill="var(--muted)" fontFamily="var(--mono)">{usd(t)}</text>
          </g>
        ))}
        <text x={L} y={H - 6} fontSize={9.5} fill="var(--muted)" fontFamily="var(--mono)">60 days ago</text>
        <text x={x(14)} y={H - 6} fontSize={9.5} fill="var(--muted)" fontFamily="var(--mono)" textAnchor="middle">14d</text>
        <text x={W - R} y={H - 6} fontSize={9.5} fill="var(--muted)" fontFamily="var(--mono)" textAnchor="end">today</text>
        {prior !== null && <line x1={x(28)} x2={x(14)} y1={y(prior)} y2={y(prior)} stroke="var(--muted)" strokeWidth={2} strokeDasharray="4 3" strokeLinecap="round" />}
        {recent !== null && <line x1={x(14)} x2={x(0)} y1={y(recent)} y2={y(recent)} stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" />}
        {points.map((p, i) => (
          <g key={`${p.date}-${i}`}>
            <circle cx={x(p.age)} cy={y(p.price)} r={4} fill="var(--chart-dot)" stroke="var(--vinyl)" strokeWidth={2} />
            <circle
              cx={x(p.age)}
              cy={y(p.price)}
              r={10}
              fill="transparent"
              onMouseEnter={() => setTip({ x: (x(p.age) / W) * 100, y: (y(p.price) / H) * 100, text: `${p.date} · ${usd(p.price)}` })}
            />
          </g>
        ))}
      </svg>
      {tip && <div className="cnb-tip" style={{ left: `${tip.x}%`, top: `${tip.y}%` }}>{tip.text}</div>}
      <p className="cnb-src">Dots are individual sales. Solid line: median of the last 14 days. Dashed: the 14 days before.</p>
    </div>
  );
}

function PriceMoves({ card, market, today }: { card: CnCard; market: CardMarket; today: string }) {
  const [grade, setGrade] = useState<"raw" | "psa10">(market.trend.grade);
  const sales = grade === "raw" ? market.sold.raw : market.sold.psa10;
  const t = market.trend;
  return (
    <section className="cnb-moves" aria-label="Price movement">
      <h3>
        <span className={t.dir} aria-hidden="true">{ARROW[t.dir] || "•"}</span>
        {t.label}
        {t.pct !== null && <span className="cnb-src">({t.grade === "psa10" ? "PSA 10" : "raw"})</span>}
      </h3>
      <p>{trendExplanation(t)}</p>

      <div className="cnb-stats">
        <div className="cnb-stat"><span>Raw · sold</span><strong>{usd(market.pc?.ungraded)}</strong><em>PriceCharting</em></div>
        <div className="cnb-stat"><span>Grade 9</span><strong>{usd(market.pc?.grade9)}</strong><em>PriceCharting</em></div>
        <div className="cnb-stat"><span>PSA 10 · sold</span><strong>{usd(market.pc?.psa10)}</strong><em>PriceCharting</em></div>
        <div className="cnb-stat">
          <span>eBay asking</span>
          <strong>{usd(market.ask?.median)}</strong>
          {market.askTrend.pct !== null ? (
            <em className={market.askTrend.dir}>{ARROW[market.askTrend.dir]} {trendWords(market.askTrend)}</em>
          ) : (
            <em>{market.ask ? `median of ${market.ask.count} live listing${market.ask.count === 1 ? "" : "s"}` : "no matching listings"}</em>
          )}
        </div>
      </div>

      <div className="cnb-tabs" role="group" aria-label="Which sales to show">
        <button type="button" aria-pressed={grade === "raw"} onClick={() => setGrade("raw")}>Raw ({market.sold.raw.length})</button>
        <button type="button" aria-pressed={grade === "psa10"} onClick={() => setGrade("psa10")}>PSA 10 ({market.sold.psa10.length})</button>
      </div>
      <SalesChart sales={sales} today={today} label={grade === "raw" ? "Raw eBay sales" : "PSA 10 eBay sales"} />

      {sales.length > 0 && (
        <table className="cnb-sales">
          <thead><tr><th>Date</th><th>Listing</th><th>Sold</th></tr></thead>
          <tbody>
            {[...sales].reverse().slice(0, 8).map((s, i) => (
              <tr key={`${s.date}-${i}`}>
                <td>{s.date.slice(5)}</td>
                <td className="t">{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title || "eBay sale"}</a> : s.title || "eBay sale"}</td>
                <td>{usd(s.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {market.ask && market.ask.sample.length > 0 && (
        <table className="cnb-sales">
          <thead><tr><th colSpan={2}>Cheapest live eBay US listings</th><th>Ask</th></tr></thead>
          <tbody>
            {market.ask.sample.slice(0, 3).map((s, i) => (
              <tr key={i}><td colSpan={2} className="t"><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></td><td>{usd(s.price)}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="cnb-src">
        Sold prices: <a href={market.pc?.url ?? `https://www.pricecharting.com/game/${card.pc}`} target="_blank" rel="noreferrer">PriceCharting</a>, which records eBay sales.
        Asking prices: eBay US Buy It Now listings that name this card, ungraded only.
      </p>
    </section>
  );
}

export default function ChinaBinderPage() {
  const [filter, setFilter] = useState<(typeof LINES)[number]>("All");
  const [market, setMarket] = useState<MarketResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "offline">("loading");
  const [open, setOpen] = useState<number | null>(null);
  const [showMoves, setShowMoves] = useState(false);
  const lastFocus = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FILTER_KEY);
      if (saved && (LINES as string[]).includes(saved)) setFilter(saved as (typeof LINES)[number]);
    } catch {}
    let cancelled = false;
    fetch("/api/pokemon-cn-binder/market")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = (await res.json()) as MarketResponse;
        if (!cancelled) { setMarket(data); setStatus("live"); }
      })
      .catch(() => { if (!cancelled) setStatus("offline"); });
    return () => { cancelled = true; };
  }, []);

  const view = useMemo(() => CARDS.filter((c) => filter === "All" || SETS[c.set].line === filter), [filter]);
  const pages = useMemo(() => {
    const out: CnCard[][] = [];
    for (let i = 0; i < view.length; i += 9) out.push(view.slice(i, i + 9));
    return out;
  }, [view]);

  const choose = (line: (typeof LINES)[number]) => {
    setFilter(line);
    try { localStorage.setItem(FILTER_KEY, line); } catch {}
  };

  const openCard = useCallback((index: number, moves = false) => {
    if (open === null) lastFocus.current = document.activeElement as HTMLElement | null;
    setOpen((index + view.length) % view.length);
    setShowMoves(moves);
  }, [open, view.length]);

  const close = useCallback(() => {
    setOpen(null);
    lastFocus.current?.focus();
  }, []);

  useEffect(() => {
    if (open === null) return;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLButtonElement>(".cnb-close")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") openCard(open - 1, showMoves);
      else if (e.key === "ArrowRight") openCard(open + 1, showMoves);
      else if (e.key === "Tab" && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll<HTMLElement>("button, a")];
        const i = items.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1]?.focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0]?.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, showMoves, close, openCard]);

  const statusText =
    status === "loading" ? "Loading live prices…"
    : status === "offline" ? "Live prices unavailable. Showing prices researched 25 Nov 2026."
    : `Live prices · updated ${new Date(market!.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;

  const card = open !== null ? view[open] : null;
  const cardMarket = card ? market?.cards[card.id] : undefined;
  const cardHead = card ? headline(card, cardMarket) : null;
  const set = card ? SETS[card.set] : null;

  return (
    <div className="cnb-wrap">
      <Link href="/" className="cnb-back">← Clearandsweet</Link>
      <header className="cnb-head">
        <div className="cnb-eyebrow">Simplified Chinese · 简体中文 · art not printed in English or Japanese</div>
        <h1>China-only <span>IR &amp; SIR</span> binder</h1>
        <p className="cnb-lede">
          {CARDS.length} Pokémon cards whose artwork exists only in the Simplified Chinese TCG: the Gem Pack line (CBB1C–CBB7C), the 151C Pikachu art rares and the China-only Special Art Rares. Tap a card to open it. Each pocket shows its US eBay price and which way it moved over the last two weeks.
        </p>
        <div className="cnb-legend">
          <span><b>RAW · SOLD</b> ungraded, from eBay sales</span>
          <span><b>ASK</b> live eBay listings</span>
          <span><span className="up">▲</span> / <span className="down">▼</span> 14-day move</span>
          <span><b>▬</b> within 2%</span>
        </div>
        <div className="cnb-toolbar">
          <div className="cnb-filters" role="group" aria-label="Filter by product line">
            {LINES.map((line) => (
              <button key={line} type="button" aria-pressed={filter === line} onClick={() => choose(line)}>
                {line} · {line === "All" ? CARDS.length : CARDS.filter((c) => SETS[c.set].line === line).length}
              </button>
            ))}
          </div>
          <span className="cnb-status" role="status">{statusText}</span>
        </div>
      </header>

      <main aria-label="Binder pages" style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        {pages.map((page, pi) => {
          const codes = [...new Set(page.map((c) => SETS[c.set].code))];
          return (
            <section key={pi} className="cnb-page">
              <div className="cnb-page-label">
                <span>Page {pi + 1}</span>
                <span>{codes.slice(0, 3).join(" · ")}{codes.length > 3 ? " …" : ""}</span>
              </div>
              <div className="cnb-grid">
                {page.map((c, j) => {
                  const m = market?.cards[c.id];
                  const h = headline(c, m);
                  const dir = m?.trend.dir ?? "none";
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className="cnb-pocket"
                      onClick={() => openCard(pi * 9 + j)}
                      aria-label={`${c.name} ${c.rarity}, ${SETS[c.set].name} ${c.no}. ${h ? `${h.price} ${h.basis}` : "No US sale found"}${m && m.trend.pct !== null ? `. ${m.trend.label}` : ""}`}
                    >
                      <span className="cnb-card">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/pokemon-cn-binder/cards/${c.img}.webp`} alt="" loading="lazy" decoding="async" width={700} height={977} />
                      </span>
                      <span className={`cnb-chip${h ? "" : " none"}`}>
                        <strong>
                          {h ? h.price : "—"}
                          {dir !== "none" && <span className={`tr ${dir}`} aria-hidden="true">{ARROW[dir]}</span>}
                        </strong>
                        <span>{h ? h.basis : "no US sale yet"}</span>
                      </span>
                      <span className="cnb-cap"><b>{c.name}</b> <span className="set">· {SETS[c.set].name}</span></span>
                    </button>
                  );
                })}
                {page.length % 3 !== 0 &&
                  Array.from({ length: 3 - (page.length % 3) }, (_, k) => (
                    <div key={`e${k}`} className="cnb-pocket empty" aria-hidden="true"><span className="cnb-card" /></div>
                  ))}
              </div>
            </section>
          );
        })}
      </main>

      <footer className="cnb-foot">
        <div>Sold prices and sale history come from PriceCharting&apos;s record of eBay sales. Asking prices come from live eBay US listings. Both refresh once a day, and the page keeps a daily reading so 14-day moves can be compared.</div>
        <div>Card scans, illustrator credits and release dates: Poké Exclusives. Exclusivity: Bulbapedia, Elite Fourum, KrystalKollectz, TCGGuy.</div>
      </footer>

      {card && set && (
        <div className="cnb-lb" role="dialog" aria-modal="true" aria-labelledby="cnb-title" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="cnb-lb-inner" ref={dialogRef}>
            <button className="cnb-close" type="button" aria-label="Close" onClick={close}>×</button>
            <button className="cnb-nav cnb-prev" type="button" aria-label="Previous card" onClick={() => openCard(open! - 1, showMoves)}>‹</button>
            <button className="cnb-nav cnb-next" type="button" aria-label="Next card" onClick={() => openCard(open! + 1, showMoves)}>›</button>
            <span className="cnb-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/pokemon-cn-binder/cards/${card.img}.webp`} alt={`${card.name} ${set.code} ${card.no}, Simplified Chinese ${card.rarity}`} width={700} height={977} />
            </span>
            <div className="cnb-info">
              <div className="cnb-eyebrow">{set.line} · {set.line === "Gem Packs" ? "Gem Pack illustration rare" : RARITY_NAME[card.rarity]}</div>
              <h2 id="cnb-title">{card.name}</h2>
              <dl>
                <dt>Set</dt><dd>{set.name} ({set.code})</dd>
                <dt>Number</dt><dd>{card.no}</dd>
                <dt>Illustrator</dt><dd>{card.artist}</dd>
                <dt>Released</dt><dd>{set.date}</dd>
                <dt>Exclusive</dt><dd>Art printed only in Simplified Chinese</dd>
              </dl>

              <div className="cnb-price">
                <div className="cnb-price-top">
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span className="basis">eBay US · {cardHead ? cardHead.basis : "no sales yet"}</span>
                    <span className="big">{cardHead ? cardHead.price : "—"}</span>
                  </div>
                  {cardMarket && (
                    <button
                      type="button"
                      className={`cnb-trend-btn ${cardMarket.trend.dir}`}
                      aria-expanded={showMoves}
                      aria-controls="cnb-moves"
                      onClick={() => setShowMoves((v) => !v)}
                    >
                      {cardMarket.trend.dir !== "none" && <span aria-hidden="true">{ARROW[cardMarket.trend.dir]}</span>}
                      {trendWords(cardMarket.trend)}
                      <span className="caret" aria-hidden="true">{showMoves ? "▴" : "▾"}</span>
                    </button>
                  )}
                </div>
                <p>{cardHead ? cardHead.detail : "I found no reliable US sale for this card yet."}{status === "loading" ? " Loading live prices…" : ""}</p>
              </div>

              {showMoves && cardMarket && market && (
                <div id="cnb-moves"><PriceMoves key={card.id} card={card} market={cardMarket} today={market.today} /></div>
              )}

              {card.note && <p className="cnb-note">{card.note}</p>}
              <div className="cnb-actions">
                <a href={ebaySold(card)} target="_blank" rel="noreferrer">Check eBay sold</a>
                <a className="alt" href={ebayLive(card)} target="_blank" rel="noreferrer">Live listings</a>
                <a className="alt" href={cardMarket?.pc?.url ?? `https://www.pricecharting.com/game/${card.pc}`} target="_blank" rel="noreferrer">PriceCharting</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
