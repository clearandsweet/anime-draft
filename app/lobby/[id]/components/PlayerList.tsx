import React from "react";
import { LobbyState, Character } from "../../../api/lobby/logic";
import { colorStyleForColor } from "../../../lib/colors";

type Props = {
    lobby: LobbyState;
    downloadingBoards: Record<string, boolean>;
    onDownloadBoard: (playerId: string) => void;
    boardRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
    squareImages?: boolean;
};

export function PlayerList({
    lobby,
    downloadingBoards,
    onDownloadBoard,
    boardRefs,
    squareImages = false,
}: Props) {
    return (
        <aside className="min-w-0 space-y-4 pr-1 lg:max-h-[80vh] lg:overflow-y-auto">
            {lobby.players.map((p, i) => {
                const col = colorStyleForColor(p.color);
                const isOnClock = i === lobby.currentPlayerIndex;
                const downloading = Boolean(downloadingBoards[p.id]);

                return (
                    <div
                        key={p.id}
                        className={`min-w-0 rounded-xl border p-3 bg-neutral-900 ${isOnClock ? col.border : "border-neutral-700"
                            }`}
                    >
                        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                            <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                            <span className="shrink-0 text-xs text-neutral-500">
                                {p.popularityTotal.toLocaleString()} {"\u2665"}
                            </span>
                            <button
                                onClick={() => onDownloadBoard(p.id)}
                                disabled={downloading}
                                className="shrink-0 rounded border border-neutral-800 px-2 py-1 text-[10px] text-neutral-500 hover:border-neutral-700 hover:text-neutral-300"
                            >
                                {downloading ? "Saving..." : "Save PNG"}
                            </button>
                        </div>

                        {/* We need to capture this specific div for the PNG export */}
                        <div
                            ref={(el) => {
                                boardRefs.current[p.id] = el;
                            }}
                            className="min-w-0 bg-neutral-900"
                        >
                            <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-3 sm:grid-cols-5">
                                {Object.entries(p.slots).map(([slotName, charValue]) => {
                                    const char = charValue as Character | null;
                                    return (
                                        <div
                                            key={slotName}
                                            className={`group relative w-full overflow-hidden rounded border ${squareImages ? "aspect-square" : "aspect-[3/4]"} ${col.glow}`}
                                        >
                                            {char ? (
                                                <>
                                                    <img
                                                        src={char.image.large}
                                                        alt={char.name.full}
                                                        className={`w-full h-full ${squareImages ? "object-contain" : "object-cover"}`}
                                                    />
                                                    <div className="absolute inset-x-0 top-0 truncate bg-gradient-to-b from-black/90 to-transparent px-1.5 pb-3 pt-1 text-center text-[10px] font-semibold text-white">
                                                        {char.name.full}
                                                    </div>
                                                    <div
                                                        className={`absolute bottom-0 left-0 right-0 truncate bg-black/75 px-1 py-[3px] text-center text-[11px] font-semibold ${col.text}`}
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
