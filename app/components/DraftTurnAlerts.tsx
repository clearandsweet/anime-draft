"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getDraftTurnAlertBody,
  getDraftTurnKey,
  getTurnAlertsEnabled,
  rememberTurnAlertsEnabled,
  shouldAnnounceDraftTurn,
  type DraftTurnAlertType,
} from "../lib/draftTurnAlerts";

type DraftTurnAlertsProps = {
  lobbyId: string;
  draftType: DraftTurnAlertType;
  viewerName: string;
  currentPlayer: { id: string; name: string } | null;
  round: number;
  completedTurnCount: number;
  draftActive: boolean;
  isPaused: boolean;
};

type WebkitAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export function DraftTurnAlerts({
  lobbyId,
  draftType,
  viewerName,
  currentPlayer,
  round,
  completedTurnCount,
  draftActive,
  isPaused,
}: DraftTurnAlertsProps) {
  const [enabled, setEnabled] = useState(false);
  const [preferenceReady, setPreferenceReady] = useState(false);
  const [status, setStatus] = useState("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const originalTitleRef = useRef("");
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPlayerName = currentPlayer?.name ?? "";
  const turnKey = useMemo(
    () =>
      getDraftTurnKey(
        round,
        currentPlayer?.id ?? "",
        completedTurnCount
      ),
    [completedTurnCount, currentPlayer?.id, round]
  );
  const previousTurnKeyRef = useRef(turnKey);
  const viewerIsCurrent =
    Boolean(viewerName.trim()) &&
    viewerName.trim().toLowerCase() ===
      currentPlayerName.trim().toLowerCase();
  const draftLabel = draftType === "pokemon" ? "Pokémon" : "Anime";

  useEffect(() => {
    originalTitleRef.current = document.title;
    const frame = window.requestAnimationFrame(() => {
      setEnabled(getTurnAlertsEnabled());
      setPreferenceReady(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      if (audioContextRef.current?.state !== "closed") {
        void audioContextRef.current?.close();
      }
      if (originalTitleRef.current) document.title = originalTitleRef.current;
    };
  }, []);

  useEffect(() => {
    if (!originalTitleRef.current) return;
    document.title =
      enabled && draftActive && viewerIsCurrent
        ? `Your turn! · ${draftLabel} Draft #${lobbyId}`
        : originalTitleRef.current;
  }, [draftActive, draftLabel, enabled, lobbyId, viewerIsCurrent]);

  const showStatus = useCallback((message: string) => {
    setStatus(message);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatus(""), 3500);
  }, []);

  const playChime = useCallback(async () => {
    try {
      const AudioContextConstructor =
        window.AudioContext ??
        (window as WebkitAudioWindow).webkitAudioContext;
      if (!AudioContextConstructor) return false;

      let context = audioContextRef.current;
      if (!context || context.state === "closed") {
        context = new AudioContextConstructor();
        audioContextRef.current = context;
      }
      if (context.state === "suspended") await context.resume();

      const startAt = context.currentTime;
      [659.25, 880].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const noteStart = startAt + index * 0.13;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, noteStart);
        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.16, noteStart + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.2);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(noteStart);
        oscillator.stop(noteStart + 0.21);
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const vibrate = useCallback((pattern: number | number[]) => {
    try {
      return navigator.vibrate?.(pattern) ?? false;
    } catch {
      return false;
    }
  }, []);

  const sendSystemNotification = useCallback(() => {
    if (
      typeof Notification === "undefined" ||
      Notification.permission !== "granted" ||
      !document.hidden
    ) {
      return false;
    }

    try {
      const notification = new Notification("You are on the clock!", {
        body: getDraftTurnAlertBody(
          draftType,
          lobbyId,
          currentPlayerName || viewerName
        ),
        icon: "/favicon.ico",
        tag: `clearandsweet-turn-${lobbyId}`,
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      return true;
    } catch {
      return false;
    }
  }, [currentPlayerName, draftType, lobbyId, viewerName]);

  useEffect(() => {
    const previousTurnKey = previousTurnKeyRef.current;
    previousTurnKeyRef.current = turnKey;
    if (!preferenceReady) return;

    if (
      !shouldAnnounceDraftTurn({
        enabled,
        draftActive,
        isPaused,
        viewerName,
        currentPlayerName,
        previousTurnKey,
        currentTurnKey: turnKey,
      })
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      void playChime();
      vibrate([160, 70, 160]);
      sendSystemNotification();
      showStatus("You are on the clock.");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    currentPlayerName,
    draftActive,
    enabled,
    isPaused,
    playChime,
    preferenceReady,
    sendSystemNotification,
    showStatus,
    turnKey,
    vibrate,
    viewerName,
  ]);

  async function enableAlerts() {
    setEnabled(true);
    const remembered = rememberTurnAlertsEnabled(true);
    const soundReady = await playChime();
    vibrate(90);

    let notificationMessage = "";
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      try {
        const permission = await Notification.requestPermission();
        notificationMessage =
          permission === "granted" ? " Background notifications are ready." : "";
      } catch {
        // Sound, vibration, and title alerts still work without notifications.
      }
    } else if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      notificationMessage = " Background notifications are ready.";
    }

    showStatus(
      `${soundReady ? "Alert sound ready." : "Visual alerts ready."}${
        remembered ? "" : " This browser could not remember the setting."
      }${notificationMessage}`
    );
  }

  function disableAlerts() {
    setEnabled(false);
    rememberTurnAlertsEnabled(false);
    vibrate(0);
    showStatus("Turn alerts are off.");
  }

  async function testAlert() {
    const soundReady = await playChime();
    vibrate([100, 50, 100]);
    showStatus(soundReady ? "Test alert played." : "Visual alert test is ready.");
  }

  return (
    <section
      aria-label="Turn alert controls"
      className={`flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5 ${
        enabled
          ? "border-cyan-400/30 bg-cyan-500/10"
          : "border-neutral-800 bg-neutral-900/70"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${
          enabled
            ? "bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]"
            : "bg-neutral-600"
        }`}
      />
      <span className="text-[11px] font-semibold text-neutral-200">
        Alerts {enabled ? "on" : "off"}
      </span>
      <span className="sr-only">
        Optional sound, vibration, title cue, and background notification on
        this device.
      </span>
      {enabled && (
        <button
          type="button"
          onClick={() => {
            void testAlert();
          }}
          className="rounded-md border border-neutral-700 bg-neutral-950/70 px-2 py-1 text-[10px] font-semibold text-neutral-300 transition hover:bg-neutral-800"
        >
          Test
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          if (enabled) {
            disableAlerts();
          } else {
            void enableAlerts();
          }
        }}
        className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition ${
          enabled
            ? "border-neutral-700 bg-neutral-950/70 text-neutral-300 hover:bg-neutral-800"
            : "border-cyan-400/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25"
        }`}
      >
        {enabled ? "Turn Off" : "Enable"}
      </button>
      <span
        aria-live="polite"
        className="max-w-64 text-[10px] text-cyan-200"
      >
        {status}
      </span>
    </section>
  );
}
