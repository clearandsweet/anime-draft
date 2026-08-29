"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import BlindRankingBoard from "../../../components/BlindRankingBoard";
import { BlindRankingService, blindRankingStatusLabel } from "../../../lib/blindRanking";
import {
  PublicBlindRankingRoom,
} from "../../../lib/blindRankingRoom";
import {
  BlindRankingCredentials,
  forgetBlindRankingCredentials,
  readBlindRankingCredentials,
  rememberBlindRankingCredentials,
} from "../../../lib/blindRankingIdentity";
import { readApiResponse } from "../../../lib/apiResponse";

export default function BlindRankingRoomClient({ code: rawCode }: { code: string }) {
  const code = rawCode.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6);
  const [room, setRoom] = useState<PublicBlindRankingRoom | null>(null);
  const [credentials, setCredentials] = useState<BlindRankingCredentials | null>(null);
  const [name, setName] = useState("");
  const [service, setService] = useState<"none" | BlindRankingService>("none");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchRoom = useCallback(async (quiet = false) => {
    try {
      const response = await fetch(`/api/blind-ranking/rooms/${code}`, {
        cache: "no-store",
      });
      const data = await readApiResponse<{
        room?: PublicBlindRankingRoom;
        error?: string;
      }>(response);
      if (!response.ok || !data.room) {
        throw new Error(data.error || "Room not found.");
      }
      setRoom(data.room);
      if (!quiet) setError("");
    } catch (caught) {
      if (!quiet) {
        setError(caught instanceof Error ? caught.message : "Room not found.");
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    setCredentials(readBlindRankingCredentials(code));
    fetchRoom();
    const timer = window.setInterval(() => fetchRoom(true), 2200);
    return () => window.clearInterval(timer);
  }, [code, fetchRoom]);

  const me = useMemo(
    () => room?.participants.find((person) => person.id === credentials?.participantId) ?? null,
    [credentials?.participantId, room?.participants]
  );
  const isHost = Boolean(me && room?.hostParticipantId === me.id);

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/blind-ranking/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          source:
            room?.config.mode === "anime" && service !== "none"
              ? { service, username }
              : null,
        }),
      });
      const data = await readApiResponse<{
        room?: PublicBlindRankingRoom;
        credentials?: BlindRankingCredentials;
        error?: string;
      }>(response);
      if (!response.ok || !data.room || !data.credentials) {
        throw new Error(data.error || "Could not join the room.");
      }
      rememberBlindRankingCredentials(code, data.credentials);
      setCredentials(data.credentials);
      setRoom(data.room);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not join the room.");
    } finally {
      setBusy(false);
    }
  }

  async function startRoom() {
    if (!credentials) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/blind-ranking/rooms/${code}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      const data = await readApiResponse<{
        room?: PublicBlindRankingRoom;
        error?: string;
      }>(response);
      if (!response.ok || !data.room) {
        throw new Error(data.error || "Could not start the room.");
      }
      setRoom(data.room);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start the room.");
    } finally {
      setBusy(false);
    }
  }

  async function placeCard(slot: number) {
    if (!credentials) {
      setError("Join the room before placing a card.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/blind-ranking/rooms/${code}/place`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...credentials, slot }),
      });
      const data = await readApiResponse<{
        room?: PublicBlindRankingRoom;
        error?: string;
      }>(response);
      if (!response.ok || !data.room) {
        throw new Error(data.error || "That card could not be placed.");
      }
      setRoom(data.room);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not place the card.");
      await fetchRoom(true);
    } finally {
      setBusy(false);
    }
  }

  async function shareRoom() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function changeIdentity() {
    forgetBlindRankingCredentials(code);
    setCredentials(null);
  }

  return (
    <main className="blind-page blind-room-page">
      <div className="blind-orbit blind-orbit-one" />
      <nav className="blind-nav">
        <a href="/blind-ranking">Blind Ranking</a>
        <span>Room {code}</span>
      </nav>

      <header className="blind-room-header">
        <div>
          <p className="blind-eyebrow">Shared table</p>
          <h1>{code}</h1>
          <p>
            {room?.config.mode === "character" ? "Character" : "Anime"} ranking · top {room?.config.count ?? "—"}
          </p>
        </div>
        <button className="blind-secondary-action" onClick={shareRoom}>
          {copied ? "Link copied" : "Copy room link"}
        </button>
      </header>

      {error ? <p className="blind-error" role="alert">{error}</p> : null}

      {loading ? (
        <section className="blind-launch-panel blind-loading">Opening the room…</section>
      ) : !room ? (
        <section className="blind-launch-panel">
          <h2>That room could not be found.</h2>
          <a className="blind-primary-action inline" href="/blind-ranking">
            Back to Blind Ranking
          </a>
        </section>
      ) : room.status === "lobby" ? (
        <section className="blind-room-lobby">
          <article className="blind-launch-panel blind-room-roster">
            <div className="blind-panel-heading">
              <span>Players</span>
              <h2>{room.participants.length} at the table</h2>
              <p>
                The pool uses the union of every public list here. A show only
                needs to appear on one participant&apos;s selected list to qualify.
              </p>
            </div>
            <div className="blind-player-list">
              {room.participants.map((person) => (
                <div key={person.id}>
                  <span className="blind-player-avatar">{person.name.charAt(0).toUpperCase()}</span>
                  <span>
                    <strong>{person.name}</strong>
                    <small>
                      {person.id === room.hostParticipantId ? "Host" : "Player"}
                      {person.source
                        ? ` · ${person.source.service === "anilist" ? "AniList" : "MAL"}: ${person.source.username}`
                        : " · popular pool"}
                    </small>
                  </span>
                </div>
              ))}
            </div>
            <dl className="blind-room-rules">
              <div>
                <dt>Included</dt>
                <dd>{room.config.statuses.map(blindRankingStatusLabel).join(", ")}</dd>
              </div>
              <div>
                <dt>Genres</dt>
                <dd>{room.config.genres.length ? room.config.genres.join(", ") : "Any genre"}</dd>
              </div>
            </dl>
            {isHost ? (
              <button className="blind-primary-action" onClick={startRoom} disabled={busy}>
                {busy ? "Combining everyone’s lists…" : "Start the reveals"}
              </button>
            ) : me ? (
              <p className="blind-hint">Waiting for the host to start.</p>
            ) : null}
          </article>

          {!me ? (
            <article className="blind-launch-panel blind-join-room-panel">
              <div className="blind-panel-heading">
                <span>Join room</span>
                <h2>Add yourself to the pool</h2>
                <p>Your anime list is optional. It must be public to contribute shows.</p>
              </div>
              <form className="blind-setup" onSubmit={joinRoom}>
                <label className="blind-field">
                  <span>Display name</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} maxLength={32} required />
                </label>
                {room.config.mode === "anime" ? (
                  <>
                    <fieldset>
                      <legend>Your list</legend>
                      <div className="blind-segmented three">
                        <button type="button" aria-pressed={service === "none"} onClick={() => setService("none")}>Skip</button>
                        <button type="button" aria-pressed={service === "anilist"} onClick={() => setService("anilist")}>AniList</button>
                        <button type="button" aria-pressed={service === "mal"} onClick={() => setService("mal")}>MAL</button>
                      </div>
                    </fieldset>
                    {service !== "none" ? (
                      <label className="blind-field">
                        <span>{service === "anilist" ? "AniList" : "MAL"} username</span>
                        <input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={64} required />
                      </label>
                    ) : null}
                  </>
                ) : null}
                <button className="blind-primary-action" type="submit" disabled={busy}>
                  {busy ? "Joining…" : "Join the room"}
                </button>
              </form>
            </article>
          ) : (
            <button className="blind-text-action" onClick={changeIdentity}>
              Not {me.name}? Join as someone else
            </button>
          )}
        </section>
      ) : (
        <>
          <BlindRankingBoard
            board={room.board}
            currentItem={room.currentItem}
            currentNumber={room.currentIndex + 1}
            total={room.totalItems}
            busy={busy || !me}
            onPlace={placeCard}
            complete={room.status === "complete"}
            roomNote={
              room.lastAction
                ? `${room.lastAction.participantName} locked ${room.lastAction.itemTitle} at #${room.lastAction.slot + 1}.`
                : me
                  ? "Anyone in the room can place the current card."
                  : "You can watch this room, but only joined players can place cards."
            }
          />
          <div className="blind-result-actions">
            <a className="blind-secondary-action inline" href="/blind-ranking">
              New game
            </a>
            {!me && room.status === "playing" ? (
              <p className="blind-hint">This game already started, so the table is closed to new players.</p>
            ) : null}
          </div>
        </>
      )}
    </main>
  );
}
