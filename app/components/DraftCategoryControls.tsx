"use client";

type DraftCategoryControlsProps = {
  mode: "default" | "random";
  slotNames: string[];
  accent: "fuchsia" | "red";
  canManage: boolean;
  busyCategory: string | null;
  onChangeMode: (mode: "default" | "random") => void;
  onRerollCategory: (slotName: string) => void;
};

const accentStyles = {
  fuchsia: {
    active:
      "border-fuchsia-400 bg-fuchsia-500/15 text-fuchsia-100 ring-fuchsia-400/20",
    action:
      "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/20",
    chip:
      "border-fuchsia-500/30 hover:border-fuchsia-400 hover:bg-fuchsia-500/10",
    icon: "text-fuchsia-300",
  },
  red: {
    active:
      "border-red-400 bg-red-500/15 text-red-100 ring-red-400/20",
    action:
      "border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20",
    chip: "border-red-500/30 hover:border-red-400 hover:bg-red-500/10",
    icon: "text-red-300",
  },
} as const;

export function DraftCategoryControls({
  mode,
  slotNames,
  accent,
  canManage,
  busyCategory,
  onChangeMode,
  onRerollCategory,
}: DraftCategoryControlsProps) {
  const styles = accentStyles[accent];
  const busy = Boolean(busyCategory);

  return (
    <section className="rounded-xl border border-neutral-700 bg-neutral-800/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-neutral-500">
            Category Lab
          </div>
          <div className="mt-1 text-xs text-neutral-400">
            Shape the board before launch.
          </div>
        </div>
        <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-neutral-400">
          {slotNames.length} categories
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={mode === "default"}
          disabled={!canManage || busy || mode === "default"}
          onClick={() => onChangeMode("default")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default ${
            mode === "default"
              ? `${styles.active} ring-4`
              : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-600 hover:text-white"
          }`}
        >
          Default {slotNames.length}
        </button>
        <button
          type="button"
          aria-pressed={mode === "random"}
          disabled={!canManage || busy || mode === "random"}
          onClick={() => onChangeMode("random")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default ${
            mode === "random"
              ? `${styles.active} ring-4`
              : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-600 hover:text-white"
          }`}
        >
          Random {slotNames.length}
        </button>
        {mode === "random" && canManage && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onChangeMode("random")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-50 ${styles.action}`}
          >
            {busyCategory === "all" ? "Rerolling…" : "Reroll All"}
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {slotNames.map((slotName) =>
          mode === "random" && canManage ? (
            <button
              key={slotName}
              type="button"
              aria-label={`Reroll ${slotName} category`}
              title={`Replace ${slotName} and keep the other categories`}
              disabled={busy}
              onClick={() => onRerollCategory(slotName)}
              className={`group inline-flex items-center gap-1.5 rounded-lg border bg-neutral-950 px-2.5 py-1.5 text-[11px] text-neutral-300 transition disabled:cursor-wait disabled:opacity-50 ${styles.chip}`}
            >
              <span>{slotName}</span>
              <span aria-hidden="true" className={styles.icon}>
                {busyCategory === slotName ? "…" : "↻"}
              </span>
            </button>
          ) : (
            <span
              key={slotName}
              className="rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-[11px] text-neutral-300"
            >
              {slotName}
            </span>
          )
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
        {mode === "random"
          ? canManage
            ? "Reroll the full board, or tap one category to replace only that slot."
            : "The host can reroll the full board or replace one category at a time."
          : canManage
            ? "Switch to random categories to unlock full and one-slot rerolls."
            : "The host is using the default category board."}
      </p>
    </section>
  );
}
