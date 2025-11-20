import React from "react";
import { LobbyState } from "../../../api/lobby/logic";
import { colorStyleForColor } from "../../../lib/colors";

type Props = {
    lobby: LobbyState;
    className?: string;
};

export function DraftTimer({ lobby, className = "" }: Props) {
    const currentPlayer = lobby.players[lobby.currentPlayerIndex] || null;
    const onClockColor = colorStyleForColor(currentPlayer?.color);

    const clockDisplay = `${String(Math.floor(lobby.timerSeconds / 60)).padStart(
        2,
        "0"
    )}:${String(lobby.timerSeconds % 60).padStart(2, "0")}`;

    return (
        <div
            className={[
                "flex-1 min-w-[200px] text-center border rounded-xl px-4 py-3 bg-neutral-900 ring-2",
                onClockColor.ring,
                className,
            ].join(" ")}
        >
            <div className="text-sm font-bold text-white leading-tight flex flex-wrap items-center justify-center gap-2">
                <span className="uppercase text-[10px] tracking-wide text-neutral-500 font-semibold">
                    On the Clock:
                </span>
                <span className="text-lg font-extrabold text-white">
                    {currentPlayer ? currentPlayer.name : "(nobody)"}
                </span>
                <span className="text-[12px] text-neutral-400">R{lobby.round}</span>
                <span className="font-mono text-white text-[13px] bg-neutral-800/60 border border-neutral-700 rounded px-2 py-[2px]">
                    {clockDisplay}
                </span>
            </div>
        </div>
    );
}
