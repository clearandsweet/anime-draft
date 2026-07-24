"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getLobbyInviteText,
  getLobbyInviteTitle,
  getLobbyRoute,
  type LobbyDraftType,
} from "../lib/lobbyInvite";

type LobbyInvitePanelProps = {
  draftType: LobbyDraftType;
  lobbyId: string;
  hostName?: string | null;
  playerCount: number;
};

function copyWithTextArea(value: string) {
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);
  return copied;
}

export function LobbyInvitePanel({
  draftType,
  lobbyId,
  hostName,
  playerCount,
}: LobbyInvitePanelProps) {
  const [inviteUrl, setInviteUrl] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [status, setStatus] = useState("");
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPokemon = draftType === "pokemon";
  const route = useMemo(
    () => getLobbyRoute(draftType, lobbyId),
    [draftType, lobbyId]
  );
  const title = getLobbyInviteTitle(draftType);
  const inviteText = getLobbyInviteText(draftType, lobbyId, hostName);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setInviteUrl(`${window.location.origin}${route}`);
      setCanShare(typeof navigator.share === "function");
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (statusTimer.current) clearTimeout(statusTimer.current);
    };
  }, [route]);

  function showStatus(message: string) {
    setStatus(message);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(""), 2500);
  }

  async function copyInvite() {
    if (!inviteUrl) return;

    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
        copied = true;
      }
    } catch {
      // Some browsers expose clipboard access but block it until permission is granted.
    }

    if (!copied) {
      try {
        copied = copyWithTextArea(inviteUrl);
      } catch {
        // The status message below gives the player a manual fallback.
      }
    }

    if (copied) {
      showStatus("Invite link copied.");
    } else {
      showStatus("Select the link below to copy it.");
    }
  }

  async function shareInvite() {
    if (!inviteUrl || typeof navigator.share !== "function") {
      await copyInvite();
      return;
    }

    try {
      await navigator.share({ title, text: inviteText, url: inviteUrl });
      showStatus("Invite ready to send.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyInvite();
    }
  }

  const accentBorder = isPokemon ? "border-red-500/40" : "border-fuchsia-500/40";
  const accentGlow = isPokemon ? "bg-red-500/10" : "bg-fuchsia-500/10";
  const primaryButton = isPokemon
    ? "border-red-500 bg-red-600/20 text-red-100 hover:bg-red-600/30"
    : "border-fuchsia-500 bg-fuchsia-600/20 text-fuchsia-100 hover:bg-fuchsia-600/30";

  return (
    <section
      aria-labelledby={`invite-${draftType}-${lobbyId}`}
      className={`mb-6 rounded-xl border ${accentBorder} ${accentGlow} p-4`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id={`invite-${draftType}-${lobbyId}`}
              className="text-sm font-bold text-white"
            >
              Invite your draft crew
            </h2>
            <span className="rounded-full border border-neutral-600 bg-neutral-950/60 px-2 py-0.5 font-mono text-xs font-bold tracking-widest text-white">
              #{lobbyId}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-300">
            Send this link before the host starts. {playerCount}{" "}
            {playerCount === 1 ? "player is" : "players are"} here now.
          </p>
          <p className="mt-2 truncate font-mono text-[11px] text-neutral-500">
            {inviteUrl || route}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={copyInvite}
            disabled={!inviteUrl}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-50 ${primaryButton}`}
          >
            Copy Invite Link
          </button>
          {canShare && (
            <button
              type="button"
              onClick={shareInvite}
              className="rounded-lg border border-neutral-600 bg-neutral-900/80 px-3 py-2 text-sm font-semibold text-neutral-200 transition hover:bg-neutral-800"
            >
              Share Invite
            </button>
          )}
        </div>
      </div>
      <p aria-live="polite" className="mt-2 min-h-4 text-xs text-emerald-300">
        {status}
      </p>
    </section>
  );
}
