import React from "react";
import { LobbyState } from "../../../api/lobby/logic";
import { colorStyleForColor } from "../../../lib/colors";

type Props = {
    lobby: LobbyState;
    className?: string;
    isHost?: boolean;
    onTogglePause?: () => void;
};

export function DraftTimer({ lobby, className = "", isHost, onTogglePause }: Props) {
    const currentPlayer = lobby.players[lobby.currentPlayerIndex] || null;
    const onClockColor = colorStyleForColor(currentPlayer?.color);

    const clockDisplay = `${String(Math.floor(lobby.timerSeconds / 60)).padStart(
        2,
        "0"
    )}:${String(lobby.timerSeconds % 60).padStart(2, "0")}`;

    const isPaused = lobby.isPaused;

    return (
        <div className={`flex gap-2 items-center justify-center ${className}`}>
            <div
                className={[
                    "flex-1 min-w-[200px] text-center border rounded-xl px-4 py-3 bg-neutral-900 ring-2",
                    isPaused ? "ring-amber-500 border-amber-500/50" : onClockColor.ring,
                ].join(" ")}
            >
                <div className="text-sm font-bold text-white leading-tight flex flex-wrap items-center justify-center gap-2">
                    <span className="uppercase text-[10px] tracking-wide text-neutral-500 font-semibold">
                        {isPaused ? "DRAFT PAUSED" : "On the Clock:"}
                    </span>
                    {!isPaused && (
                        <span className="text-lg font-extrabold text-white">
                            {currentPlayer ? currentPlayer.name : "(nobody)"}
                        </span>
                    )}
                    <span className="text-[12px] text-neutral-400">R{lobby.round}</span>
                    <span className={`font-mono text-[13px] border rounded px-2 py-[2px] ${isPaused ? "text-amber-400 border-amber-500/50 bg-amber-500/10" : "text-white bg-neutral-800/60 border-neutral-700"}`}>
                        {clockDisplay}
                    </span>
                </div>
            </div>
            {isHost && onTogglePause && (
                <button
                    onClick={onTogglePause}
                    className={`h-full aspect-square flex items-center justify-center rounded-xl border transition ${isPaused ? "bg-emerald-600/20 border-emerald-500 text-emerald-300 hover:bg-emerald-600/30" : "bg-amber-600/20 border-amber-500 text-amber-300 hover:bg-amber-600/30"}`}
                    title={isPaused ? "Resume Draft" : "Pause Draft"}
                >
                    {isPaused ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                    )}
                </button>
            )}
        </div>
    );
}
