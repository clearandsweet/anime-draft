import React from "react";
import { LobbyState, Character } from "../../../api/lobby/logic";
import { colorStyleForColor } from "../../../lib/colors";

type Props = {
    lobby: LobbyState;
    downloadingBoards: Record<string, boolean>;
    onDownloadBoard: (playerId: string) => void;
    boardRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
};

export function PlayerList({
    lobby,
    downloadingBoards,
    onDownloadBoard,
    boardRefs,
}: Props) {
    return (
        <aside className="space-y-4 overflow-y-auto max-h-[80vh] pr-1">
            {lobby.players.map((p, i) => {
                const col = colorStyleForColor(p.color);
                const isOnClock = i === lobby.currentPlayerIndex;
                const downloading = Boolean(downloadingBoards[p.id]);

                return (
                    <div
                        key={p.id}
                        className={`rounded-xl border p-3 bg-neutral-900 ${isOnClock ? col.border : "border-neutral-700"
                            }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold">{p.name}</span>
                            <span className="text-xs text-neutral-500">
                                {p.popularityTotal.toLocaleString()} {"\u2665"}
                            </span>
                            <button
                                onClick={() => onDownloadBoard(p.id)}
                                disabled={downloading}
                                className="text-[10px] text-neutral-500 hover:text-neutral-300"
                            >
                                {downloading ? "Saving..." : "Save PNG"}
                            </button>
                        </div>

                        {/* We need to capture this specific div for the PNG export */}
                        <div
                            ref={(el) => {
                                boardRefs.current[p.id] = el;
                            }}
                            className="bg-neutral-900" // Wrapper for capture if needed, or just capture the grid
                        >
                            <div className="grid grid-cols-5 gap-2">
                                {Object.entries(p.slots).map(([slotName, charValue]) => {
                                    const char = charValue as Character | null;
                                    return (
                                        <div
                                            key={slotName}
                                            className={`relative w-[90px] h-[120px] rounded border overflow-hidden ${col.glow} group`}
                                        >
                                            {char ? (
                                                <>
                                                    <img
                                                        src={char.image.large}
                                                        alt={char.name.full}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div
                                                        className={`absolute bottom-0 left-0 right-0 bg-black/70 text-[11px] font-semibold text-center py-[3px] ${col.text}`}
                                                    >
                                                        {slotName}
                                                    </div>
                                                    <div className="absolute inset-0 bg-black/80 text-[11px] text-white font-semibold flex items-center justify-center px-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {char.name.full}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex items-center justify-center w-full h-full text-[11px] font-semibold text-neutral-600 text-center leading-tight px-1">
                                                    {slotName}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })}
        </aside>
    );
}
