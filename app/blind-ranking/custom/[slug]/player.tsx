"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BlindRankingBoard from "../../../components/BlindRankingBoard";
import {
  createBlindRankingBoard,
  placeBlindRankingItem,
  type BlindRankingItem,
} from "../../../lib/blindRanking";
import type { CustomRanking } from "../../../lib/customRanking";
import {
  customRankingManageKey,
  forgetSavedCustomRanking,
} from "../../../lib/customRankingIdentity";
import { readApiResponse } from "../../../lib/apiResponse";

export default function CustomRankingPlayer({ slug }: { slug: string }) {
  const [ranking, setRanking] = useState<CustomRanking | null>(null);
  const [items, setItems] = useState<BlindRankingItem[]>([]);
  const [board, setBoard] = useState<(BlindRankingItem | null)[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/blind-ranking/custom/${slug}`, { cache: "no-store" });
        const data = await readApiResponse<{ ranking?: CustomRanking; error?: string }>(response);
        if (!response.ok || !data.ranking) throw new Error(data.error || "Ranking not found.");
        if (!active) return;
        setRanking(data.ranking);
        setCanManage(Boolean(customRankingManageKey(data.ranking.id)));
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Ranking not found.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [slug]);

  const complete = items.length > 0 && currentIndex >= items.length;
  const currentItem = items[currentIndex] ?? null;

  async function startGame() {
    if (!ranking) return;
    setStarting(true);
    setError("");
    try {
      const response = await fetch(`/api/blind-ranking/custom/${slug}/play`, { method: "POST" });
      const data = await readApiResponse<{ items?: BlindRankingItem[]; error?: string }>(response);
      if (!response.ok || !data.items) throw new Error(data.error || "The game could not start.");
      setItems(data.items);
      setBoard(createBlindRankingBoard(ranking.playCount));
      setCurrentIndex(0);
      setCopied("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The game could not start.");
    } finally {
      setStarting(false);
    }
  }

  function place(slot: number) {
    if (!currentItem) return;
    const result = placeBlindRankingItem(board, slot, currentItem);
    if (!result.ok) return setError(result.error);
    setBoard(result.board);
    setCurrentIndex((current) => current + 1);
  }

  const resultText = useMemo(() => {
    if (!ranking || !complete) return "";
    return [
      ranking.title,
      ...board.map((item, index) => `${index + 1}. ${item?.title || "—"}`),
      window.location.href,
    ].join("\n");
  }, [board, complete, ranking]);

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1600);
  }

  async function deleteRanking() {
    if (!ranking || !window.confirm("Delete this public ranking and all of its pictures?")) return;
    const manageKey = customRankingManageKey(ranking.id);
    if (!manageKey) return;
    const response = await fetch(`/api/blind-ranking/custom/${slug}`, {
      method: "DELETE",
      headers: { "x-manage-key": manageKey },
    });
    const data = await readApiResponse<{ error?: string }>(response);
    if (!response.ok) return setError(data.error || "The ranking could not be deleted.");
    forgetSavedCustomRanking(ranking.id);
    window.location.href = "/blind-ranking/custom";
  }

  return (
    <main className="blind-page custom-play-page">
      <nav className="blind-nav">
        <Link href="/blind-ranking/custom">Custom Rankings</Link>
        <span>{items.length ? "Playing" : "Ready"}</span>
      </nav>

      {loading ? <section className="blind-launch-panel blind-loading">Opening the ranking…</section> : null}
      {error ? <p className="blind-error" role="alert">{error}</p> : null}

      {ranking && !items.length ? (
        <>
          <header className="custom-play-hero">
            <div>
              <p className="blind-eyebrow">A top {ranking.playCount} by {ranking.creator}</p>
              <h1>{ranking.title}</h1>
              <p>{ranking.description || "One reveal at a time. No changing your mind."}</p>
              <div className="custom-tag-row">
                {ranking.tags.map((tag) => <em key={tag}>{tag}</em>)}
              </div>
            </div>
            <div className="custom-play-stats">
              <strong>{ranking.items.length}</strong><span>possible reveals</span>
              <strong>{ranking.playCount}</strong><span>make your final list</span>
              <strong>{ranking.playsCount}</strong><span>games started</span>
            </div>
          </header>

          <section className="custom-preview-strip" aria-hidden="true">
            {ranking.items.slice(0, 8).map((item, index) => (
              // Uploaded artwork is served by the custom image route.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" key={item.id} style={{ transform: `rotate(${index % 2 ? 2 : -2}deg)` }} />
            ))}
            <div className="custom-preview-secret">?</div>
          </section>

          <div className="custom-play-actions">
            <button className="blind-primary-action" onClick={startGame} disabled={starting}>
              {starting ? "Shuffling…" : "Start the reveals"}
            </button>
            <button className="blind-secondary-action" onClick={() => copy(window.location.href, "link")}>
              {copied === "link" ? "Link copied" : "Copy game link"}
            </button>
            {canManage ? (
              <button className="custom-delete-action" onClick={deleteRanking}>Delete my ranking</button>
            ) : null}
          </div>
        </>
      ) : null}

      {ranking && items.length ? (
        <>
          <header className="custom-game-title">
            <p>Playing</p><h1>{ranking.title}</h1>
          </header>
          <BlindRankingBoard
            board={board}
            currentItem={currentItem}
            currentNumber={currentIndex + 1}
            total={items.length}
            busy={false}
            onPlace={place}
            complete={complete}
          />
          {complete ? (
            <div className="blind-result-actions">
              <button className="blind-primary-action" onClick={() => copy(resultText, "results")}>
                {copied === "results" ? "Copied" : "Copy results"}
              </button>
              <button className="blind-secondary-action" onClick={startGame} disabled={starting}>
                {starting ? "Shuffling…" : "Play a new shuffle"}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <footer className="blind-footer">Custom Blind Ranking · Clear &amp; Sweet</footer>
    </main>
  );
}
