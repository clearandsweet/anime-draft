"use client";

import { BlindRankingItem } from "../lib/blindRanking";

function Artwork({ item, compact = false }: { item: BlindRankingItem; compact?: boolean }) {
  if (!item.image) {
    return <div className={`blind-artwork-fallback ${compact ? "compact" : ""}`}>?</div>;
  }
  return (
    // External list artwork comes from AniList or MyAnimeList and is not transformed.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.image} alt="" draggable={false} />
  );
}

export default function BlindRankingBoard({
  board,
  currentItem,
  currentNumber,
  total,
  busy,
  onPlace,
  complete,
  roomNote,
}: {
  board: (BlindRankingItem | null)[];
  currentItem: BlindRankingItem | null;
  currentNumber: number;
  total: number;
  busy: boolean;
  onPlace: (slot: number) => void | Promise<void>;
  complete: boolean;
  roomNote?: string;
}) {
  return (
    <section className={`blind-game-shell ${complete ? "complete" : ""}`}>
      <div className="blind-reveal-panel" aria-live="polite">
        {complete ? (
          <div className="blind-finish-mark">
            <span>Locked in</span>
            <h2>Your blind ranking</h2>
            <p>No reshuffles. No regrets.</p>
          </div>
        ) : currentItem ? (
          <>
            <div className="blind-round-label">
              Reveal {Math.min(currentNumber, total)} of {total}
            </div>
            <article
              className="blind-current-card"
              draggable={!busy}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", currentItem.id);
              }}
            >
              <Artwork item={currentItem} />
              <div>
                <p>Rank this now</p>
                <h2>{currentItem.title}</h2>
                <span>{currentItem.subtitle}</span>
              </div>
            </article>
            <p className="blind-drag-hint">
              Drag the card to an open slot, or tap a slot. Once placed, it is
              locked—and the next reveal appears.
            </p>
          </>
        ) : (
          <p className="blind-hint">Waiting for the next reveal…</p>
        )}
        {roomNote ? <p className="blind-room-note">{roomNote}</p> : null}
      </div>

      <div className="blind-board" aria-label="Blind ranking board">
        {board.map((item, index) => (
          <button
            key={index}
            type="button"
            className={`blind-rank-slot ${item ? "filled" : "open"}`}
            disabled={Boolean(item) || !currentItem || busy || complete}
            onClick={() => onPlace(index)}
            onDragOver={(event) => {
              if (!item && currentItem && !busy) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (!item && currentItem && !busy) onPlace(index);
            }}
            aria-label={item ? `Rank ${index + 1}: ${item.title}` : `Place current card at rank ${index + 1}`}
          >
            <span className="blind-rank-number">{index + 1}</span>
            {item ? (
              <span className="blind-ranked-item">
                <Artwork item={item} compact />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.subtitle}</small>
                </span>
              </span>
            ) : (
              <span className="blind-empty-slot">
                {index === 0 ? "Best" : index === board.length - 1 ? "Last" : "Open slot"}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
