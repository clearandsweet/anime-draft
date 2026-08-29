"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import BlindRankingBoard from "../components/BlindRankingBoard";
import BlindRankingSetup, {
  BlindRankingSetupValue,
} from "../components/BlindRankingSetup";
import {
  BlindRankingItem,
  createBlindRankingBoard,
  placeBlindRankingItem,
} from "../lib/blindRanking";
import { rememberBlindRankingCredentials } from "../lib/blindRankingIdentity";
import { readApiResponse } from "../lib/apiResponse";

type PlayMode = "solo" | "room";

export default function BlindRankingPage() {
  const [playMode, setPlayMode] = useState<PlayMode>("solo");
  const [items, setItems] = useState<BlindRankingItem[]>([]);
  const [board, setBoard] = useState<(BlindRankingItem | null)[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);

  const currentItem = items[currentIndex] ?? null;
  const complete = items.length > 0 && currentIndex >= items.length;

  async function startSolo(value: BlindRankingSetupValue) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/blind-ranking/pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...value, seed: crypto.randomUUID() }),
      });
      const data = await readApiResponse<{
        items?: BlindRankingItem[];
        error?: string;
      }>(response);
      if (!response.ok || !data.items) {
        throw new Error(data.error || "The ranking pool could not be loaded.");
      }
      setItems(data.items);
      setBoard(createBlindRankingBoard(value.count));
      setCurrentIndex(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start the game.");
    } finally {
      setLoading(false);
    }
  }

  async function createRoom(value: BlindRankingSetupValue) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/blind-ranking/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      const data = await readApiResponse<{
        room?: { code: string };
        credentials?: { participantId: string; token: string };
        error?: string;
      }>(response);
      if (!response.ok || !data.room || !data.credentials) {
        throw new Error(data.error || "The room could not be created.");
      }
      rememberBlindRankingCredentials(data.room.code, data.credentials);
      window.location.href = `/blind-ranking/room/${data.room.code}`;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the room.");
      setLoading(false);
    }
  }

  async function placeSolo(slot: number) {
    if (!currentItem || placing) return;
    setPlacing(true);
    const result = placeBlindRankingItem(board, slot, currentItem);
    if (!result.ok) {
      setError(result.error);
      setPlacing(false);
      return;
    }
    setBoard(result.board);
    setCurrentIndex((current) => current + 1);
    setPlacing(false);
  }

  function openRoom(event: FormEvent) {
    event.preventDefault();
    const code = joinCode.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6);
    if (code.length !== 6) {
      setError("Enter the six-character room code.");
      return;
    }
    window.location.href = `/blind-ranking/room/${code}`;
  }

  const shareText = useMemo(() => {
    if (!complete) return "";
    return [
      "My Blind Ranking",
      ...board.map((item, index) => `${index + 1}. ${item?.title ?? "—"}`),
      "godisaloli.com/blind-ranking",
    ].join("\n");
  }, [board, complete]);

  async function copyResults() {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function resetSolo() {
    setItems([]);
    setBoard([]);
    setCurrentIndex(0);
    setError("");
    setCopied(false);
  }

  return (
    <main className="blind-page">
      <div className="blind-orbit blind-orbit-one" />
      <div className="blind-orbit blind-orbit-two" />
      <nav className="blind-nav">
        <Link href="/">Clear &amp; Sweet</Link>
        <span>Blind Ranking</span>
      </nav>

      <header className="blind-hero">
        <p className="blind-eyebrow">One reveal. One permanent choice.</p>
        <h1>
          Rank now.
          <br />
          Regret later.
        </h1>
        <p className="blind-lede">
          Shows and characters arrive one at a time. Place each card before you
          know what comes next—and live with the list you made.
        </p>
      </header>

      {!items.length ? (
        <Link className="custom-ranking-promo" href="/blind-ranking/custom">
          <span>New · Community rankings</span>
          <strong>Play a custom list—or build your own.</strong>
          <em>Browse rankings →</em>
        </Link>
      ) : null}

      {items.length ? (
        <>
          <BlindRankingBoard
            board={board}
            currentItem={currentItem}
            currentNumber={currentIndex + 1}
            total={items.length}
            busy={placing}
            onPlace={placeSolo}
            complete={complete}
          />
          {complete ? (
            <div className="blind-result-actions">
              <button className="blind-primary-action" onClick={copyResults}>
                {copied ? "Copied" : "Copy results"}
              </button>
              <button className="blind-secondary-action" onClick={resetSolo}>
                Play again
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <section className="blind-launch-panel">
          <div className="blind-mode-tabs" role="tablist" aria-label="Play mode">
            <button
              type="button"
              role="tab"
              aria-selected={playMode === "solo"}
              onClick={() => {
                setPlayMode("solo");
                setError("");
              }}
            >
              Solo
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={playMode === "room"}
              onClick={() => {
                setPlayMode("room");
                setError("");
              }}
            >
              Multiplayer room
            </button>
          </div>

          {error ? <p className="blind-error" role="alert">{error}</p> : null}

          {playMode === "solo" ? (
            <BlindRankingSetup
              busy={loading}
              submitLabel="Start the reveals"
              onSubmit={startSolo}
            />
          ) : (
            <div className="blind-room-launch-grid">
              <article>
                <div className="blind-panel-heading">
                  <span>New room</span>
                  <h2>Build a shared pool</h2>
                  <p>
                    Everyone can add a public anime list. When the host starts,
                    any matching show from any participant can enter the game.
                  </p>
                </div>
                <BlindRankingSetup
                  room
                  busy={loading}
                  submitLabel="Create room"
                  onSubmit={createRoom}
                />
              </article>
              <article className="blind-join-card">
                <div className="blind-panel-heading">
                  <span>Have a code?</span>
                  <h2>Join the table</h2>
                  <p>
                    Open the room, add your name and optional list, then rank
                    together in real time.
                  </p>
                </div>
                <form onSubmit={openRoom}>
                  <label className="blind-field">
                    <span>Room code</span>
                    <input
                      value={joinCode}
                      onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                      maxLength={6}
                      placeholder="ABC234"
                      autoCapitalize="characters"
                      required
                    />
                  </label>
                  <button className="blind-primary-action" type="submit">
                    Open room
                  </button>
                </form>
              </article>
            </div>
          )}
        </section>
      )}

      <footer className="blind-footer">
        Powered by public AniList data and public MyAnimeList imports.
      </footer>
    </main>
  );
}
