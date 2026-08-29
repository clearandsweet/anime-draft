"use client";

import { FormEvent, useState } from "react";
import {
  BLIND_RANKING_COUNTS,
  BLIND_RANKING_GENRES,
  BLIND_RANKING_STATUSES,
  BlindRankingConfig,
  BlindRankingService,
  BlindRankingSource,
  blindRankingStatusLabel,
} from "../lib/blindRanking";

export type BlindRankingSetupValue = BlindRankingConfig & {
  name?: string;
  source: BlindRankingSource | null;
};

export default function BlindRankingSetup({
  room,
  busy,
  submitLabel,
  onSubmit,
}: {
  room?: boolean;
  busy: boolean;
  submitLabel: string;
  onSubmit: (value: BlindRankingSetupValue) => void | Promise<void>;
}) {
  const [mode, setMode] = useState<"anime" | "character">("anime");
  const [count, setCount] = useState<5 | 7 | 10>(5);
  const [name, setName] = useState("");
  const [service, setService] = useState<"popular" | BlindRankingService>(
    "popular"
  );
  const [username, setUsername] = useState("");
  const [statuses, setStatuses] = useState([...BLIND_RANKING_STATUSES]);
  const [genres, setGenres] = useState<string[]>([]);

  function toggleStatus(status: (typeof BLIND_RANKING_STATUSES)[number]) {
    setStatuses((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status]
    );
  }

  function toggleGenre(genre: string) {
    setGenres((current) =>
      current.includes(genre)
        ? current.filter((item) => item !== genre)
        : [...current, genre]
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (room && !name.trim()) return;
    if (mode === "anime" && service !== "popular" && !username.trim()) return;
    await onSubmit({
      mode,
      count,
      name: room ? name.trim() : undefined,
      source:
        mode === "anime" && service !== "popular"
          ? { service, username: username.trim() }
          : null,
      statuses,
      genres: mode === "anime" ? genres : [],
    });
  }

  return (
    <form className="blind-setup" onSubmit={handleSubmit}>
      {room ? (
        <label className="blind-field">
          <span>Your display name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={32}
            placeholder="Kai"
            required
          />
        </label>
      ) : null}

      <fieldset>
        <legend>What are you ranking?</legend>
        <div className="blind-segmented two">
          <button
            type="button"
            aria-pressed={mode === "anime"}
            onClick={() => setMode("anime")}
          >
            Anime shows
          </button>
          <button
            type="button"
            aria-pressed={mode === "character"}
            onClick={() => {
              setMode("character");
              setService("popular");
            }}
          >
            Characters
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>Ranking slots</legend>
        <div className="blind-segmented three">
          {BLIND_RANKING_COUNTS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={count === value}
              onClick={() => setCount(value)}
            >
              Top {value}
            </button>
          ))}
        </div>
      </fieldset>

      {mode === "anime" ? (
        <>
          <fieldset>
            <legend>Show pool</legend>
            <div className="blind-source-grid">
              {(
                [
                  ["popular", "Popular anime"],
                  ["anilist", "My AniList"],
                  ["mal", "MyAnimeList"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={service === value}
                  onClick={() => setService(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          {service !== "popular" ? (
            <div className="blind-list-options">
              <label className="blind-field">
                <span>{service === "anilist" ? "AniList" : "MAL"} username</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  maxLength={64}
                  placeholder={service === "anilist" ? "AniList username" : "MAL username"}
                  required
                />
              </label>
              <fieldset>
                <legend>Include from my list</legend>
                <div className="blind-check-grid">
                  {BLIND_RANKING_STATUSES.map((status) => (
                    <label key={status}>
                      <input
                        type="checkbox"
                        checked={statuses.includes(status)}
                        onChange={() => toggleStatus(status)}
                      />
                      <span>{blindRankingStatusLabel(status)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          ) : null}

          <fieldset>
            <legend>
              Genres <small>optional · match any</small>
            </legend>
            <div className="blind-genre-grid">
              {BLIND_RANKING_GENRES.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  aria-pressed={genres.includes(genre)}
                  onClick={() => toggleGenre(genre)}
                >
                  {genre}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      ) : (
        <p className="blind-hint">
          Character games draw from a shuffled slice of AniList&apos;s popular
          character catalogue.
        </p>
      )}

      <button className="blind-primary-action" type="submit" disabled={busy}>
        {busy ? "Building the pool…" : submitLabel}
      </button>
    </form>
  );
}
