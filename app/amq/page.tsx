"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Curated list of popular anime with their AnimeThemes slugs (underscores, not hyphens)
const POPULAR_ANIME = [
  { slug: "shingeki_no_kyojin", hint: "Action/Drama" },
  { slug: "kimetsu_no_yaiba", hint: "Action/Fantasy" },
  { slug: "boku_no_hero_academia", hint: "Superhero/Shonen" },
  { slug: "death_note", hint: "Thriller/Psychological" },
  { slug: "fullmetal_alchemist_brotherhood", hint: "Action/Adventure" },
  { slug: "sword_art_online", hint: "Isekai/Action" },
  { slug: "steins_gate", hint: "Sci-Fi/Thriller" },
  { slug: "code_geass_hangyaku_no_lelouch", hint: "Mecha/Political" },
  { slug: "cowboy_bebop", hint: "Sci-Fi/Noir" },
  { slug: "neon_genesis_evangelion", hint: "Mecha/Psychological" },
  { slug: "hunter_x_hunter_2011", hint: "Adventure/Shonen" },
  { slug: "one_punch_man", hint: "Action/Comedy" },
  { slug: "re_zero_kara_hajimeru_isekai_seikatsu", hint: "Isekai/Drama" },
  { slug: "no_game_no_life", hint: "Isekai/Game" },
  { slug: "naruto", hint: "Ninja/Adventure" },
  { slug: "violet_evergarden", hint: "Drama/Fantasy" },
  { slug: "your_lie_in_april", hint: "Music/Romance/Drama" },
  { slug: "trigun", hint: "Sci-Fi/Western" },
  { slug: "bleach", hint: "Action/Shonen" },
  { slug: "dragon_ball_z", hint: "Action/Shonen" },
];

type SongData = {
  animeName: string;
  slug: string;
  themeSlug: string;
  songTitle: string | null;
  videoUrl: string;
};

type GameState = "idle" | "loading" | "ready" | "playing" | "paused" | "revealed";

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isCorrectGuess(guess: string, animeName: string): boolean {
  const g = normalize(guess);
  const a = normalize(animeName);
  if (!g) return false;
  // Accept if guess contains most of the title or title contains the guess (min 4 chars)
  if (g.length >= 4 && a.includes(g)) return true;
  if (a.length >= 4 && g.includes(a)) return true;
  return g === a;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AMQPage() {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [songData, setSongData] = useState<SongData | null>(null);
  const [guess, setGuess] = useState("");
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState("Loading...");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef(0); // audioCtx.currentTime when elapsed=0
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0); // mirror of elapsed for use inside callbacks
  const usedSlugsRef = useRef<Set<string>>(new Set());

  const stopPlayback = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* already stopped */ }
      sourceRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startSource = useCallback((fromElapsed: number) => {
    if (!audioBufferRef.current || !audioCtxRef.current) return;
    stopPlayback();

    const ctx = audioCtxRef.current;
    const source = ctx.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.connect(ctx.destination);
    source.start(0, fromElapsed);
    sourceRef.current = source;

    // Track position: elapsed = ctx.currentTime - startTimeRef
    startTimeRef.current = ctx.currentTime - fromElapsed;

    source.onended = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setGameState((prev) => (prev === "playing" ? "ready" : prev));
      const dur = audioBufferRef.current?.duration ?? 0;
      setElapsed(dur);
      elapsedRef.current = dur;
    };

    timerRef.current = setInterval(() => {
      if (!audioCtxRef.current) return;
      const t = audioCtxRef.current.currentTime - startTimeRef.current;
      const clamped = Math.min(t, audioBufferRef.current?.duration ?? t);
      setElapsed(clamped);
      elapsedRef.current = clamped;
    }, 100);

    setGameState("playing");
  }, [stopPlayback]);

  const loadNewSong = useCallback(async () => {
    stopPlayback();
    setGameState("loading");
    setGuess("");
    setCorrect(null);
    setError(null);
    setElapsed(0);
    elapsedRef.current = 0;
    setDuration(0);
    setSongData(null);

    // Pick an unused slug, reset if all used
    const remaining = POPULAR_ANIME.filter((a) => !usedSlugsRef.current.has(a.slug));
    const pool = remaining.length > 0 ? remaining : POPULAR_ANIME;
    if (remaining.length === 0) usedSlugsRef.current.clear();

    const pick = pool[Math.floor(Math.random() * pool.length)];
    usedSlugsRef.current.add(pick.slug);

    try {
      setLoadingMsg("Fetching song data...");
      const metaRes = await fetch(`/api/animethemes?slug=${pick.slug}`);
      if (!metaRes.ok) {
        const err = await metaRes.json().catch(() => ({}));
        throw new Error(err.error ?? `API error ${metaRes.status}`);
      }
      const meta: SongData = await metaRes.json();
      setSongData(meta);

      setLoadingMsg("Downloading audio...");
      const audioRes = await fetch(
        `/api/animethemes/proxy?url=${encodeURIComponent(meta.videoUrl)}`
      );
      if (!audioRes.ok) throw new Error("Failed to fetch audio");

      const arrayBuffer = await audioRes.arrayBuffer();

      setLoadingMsg("Reversing audio...");

      // Create (or reuse) AudioContext on user gesture
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current.state === "suspended") {
        await audioCtxRef.current.resume();
      }

      const audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);

      // Reverse all channels in place
      for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        audioBuffer.getChannelData(i).reverse();
      }

      audioBufferRef.current = audioBuffer;
      setDuration(audioBuffer.duration);
      setGameState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setGameState("idle");
    }
  }, [stopPlayback]);

  const handlePlay = useCallback(() => {
    startSource(elapsedRef.current);
  }, [startSource]);

  const handlePause = useCallback(() => {
    // elapsedRef already holds current position
    stopPlayback();
    setGameState("paused");
  }, [stopPlayback]);

  const handleReveal = useCallback(() => {
    stopPlayback();
    elapsedRef.current = 0;
    setElapsed(0);
    setGameState("revealed");
  }, [stopPlayback]);

  const handleSubmit = useCallback(() => {
    if (!songData || !guess.trim()) return;
    const ok = isCorrectGuess(guess, songData.animeName);
    setCorrect(ok);
    if (ok) {
      stopPlayback();
      setGameState("revealed");
    }
  }, [guess, songData, stopPlayback]);

  useEffect(() => {
    return () => {
      stopPlayback();
      audioCtxRef.current?.close();
    };
  }, [stopPlayback]);

  const progress = duration > 0 ? Math.min((elapsed / duration) * 100, 100) : 0;
  const isActive = gameState === "ready" || gameState === "playing" || gameState === "paused" || gameState === "revealed";

  return (
    <main className="site-page-v2">
      <section className="v2-section" style={{ maxWidth: 640, margin: "0 auto" }}>
        <div className="v2-section-head">
          <p className="v2-kicker">Mini Game</p>
          <h1 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(1.6rem, 4vw, 2.4rem)" }}>
            Anime OP Quiz — Reversed
          </h1>
          <p style={{ color: "var(--text-muted, #b9b8d0)", marginBottom: "1.5rem" }}>
            Listen to an anime opening played backwards. Name the anime.
          </p>
        </div>

        <article className="v2-panel" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* ── Load / Next button ── */}
          <button
            onClick={loadNewSong}
            disabled={gameState === "loading"}
            className="v2-btn primary"
            style={{ alignSelf: "flex-start", background: "linear-gradient(135deg, #7c3aed, #db2777)" }}
          >
            {gameState === "idle"
              ? "Start Quiz"
              : gameState === "loading"
              ? loadingMsg
              : "Next Song"}
          </button>

          {/* ── Error ── */}
          {error && (
            <p style={{ color: "#f87171", margin: 0 }}>
              Error: {error}. Try another song.
            </p>
          )}

          {/* ── Active quiz UI ── */}
          {isActive && (
            <>
              {/* Playback row */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  onClick={gameState === "playing" ? handlePause : handlePlay}
                  disabled={gameState === "revealed"}
                  className="v2-btn primary"
                  style={{
                    minWidth: 100,
                    background: "linear-gradient(135deg, #7c3aed, #db2777)",
                    opacity: gameState === "revealed" ? 0.5 : 1,
                  }}
                >
                  {gameState === "playing" ? "⏸ Pause" : "▶ Play"}
                </button>
                <span style={{ fontVariantNumeric: "tabular-nums", color: "#b9b8d0", fontSize: "0.9rem" }}>
                  {formatTime(elapsed)} / {formatTime(duration)}
                </span>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  background: "rgba(255,255,255,0.08)",
                  height: 5,
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: "linear-gradient(90deg, #7c3aed, #db2777)",
                    height: "100%",
                    width: `${progress}%`,
                    transition: "width 0.1s linear",
                    borderRadius: 3,
                  }}
                />
              </div>

              {/* Guess section */}
              {gameState !== "revealed" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <input
                    type="text"
                    className="v2-search"
                    placeholder="Name the anime..."
                    value={guess}
                    onChange={(e) => {
                      setGuess(e.target.value);
                      setCorrect(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    style={{ margin: 0 }}
                  />
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      onClick={handleSubmit}
                      disabled={!guess.trim()}
                      className="v2-btn primary"
                      style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)" }}
                    >
                      Submit
                    </button>
                    <button onClick={handleReveal} className="v2-btn ghost">
                      Give Up / Reveal
                    </button>
                  </div>

                  {correct === false && (
                    <p style={{ color: "#f87171", margin: 0, fontSize: "0.9rem" }}>
                      Not quite — keep trying or give up.
                    </p>
                  )}
                </div>
              )}

              {/* Reveal panel */}
              {gameState === "revealed" && (
                <div
                  style={{
                    background: "rgba(124,58,237,0.12)",
                    border: "1px solid rgba(124,58,237,0.3)",
                    borderRadius: 8,
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                  }}
                >
                  {correct && (
                    <p style={{ color: "#4ade80", fontWeight: 700, margin: 0 }}>
                      ✓ Correct!
                    </p>
                  )}
                  <p style={{ color: "#b9b8d0", margin: 0, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Answer
                  </p>
                  <h2 style={{ fontFamily: "Fraunces, serif", margin: 0, fontSize: "1.4rem" }}>
                    {songData?.animeName}
                  </h2>
                  {songData?.songTitle && (
                    <p style={{ color: "#b9b8d0", margin: 0, fontSize: "0.9rem" }}>
                      {songData.themeSlug} — &ldquo;{songData.songTitle}&rdquo;
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </article>

        <p style={{ color: "#b9b8d0", fontSize: "0.8rem", marginTop: "1rem", textAlign: "center" }}>
          Audio sourced from{" "}
          <a href="https://animethemes.moe" target="_blank" rel="noreferrer" style={{ color: "#9ee7dd" }}>
            AnimeThemes.moe
          </a>
        </p>
      </section>
    </main>
  );
}
