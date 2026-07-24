import type { KeyboardEvent, ReactNode } from "react";
import { isBallotActivationKey } from "../lib/ballotInteraction";

type SelectableDraftBoardProps = {
  playerName: string;
  selectionLabel: string | null;
  disabled: boolean;
  draftType: "anime" | "pokemon";
  selectedBorderClass: string;
  selectionBadgeClass: string;
  onSelect: () => void;
  children: ReactNode;
};

export function SelectableDraftBoard({
  playerName,
  selectionLabel,
  disabled,
  draftType,
  selectedBorderClass,
  selectionBadgeClass,
  onSelect,
  children,
}: SelectableDraftBoardProps) {
  const isSelected = Boolean(selectionLabel);
  const hoverBorder =
    draftType === "pokemon"
      ? "hover:border-red-500/60"
      : "hover:border-fuchsia-500/60";

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (disabled || !isBallotActivationKey(event.key)) return;
    event.preventDefault();
    onSelect();
  }

  return (
    <article
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={isSelected}
      aria-disabled={disabled}
      aria-label={
        selectionLabel
          ? `${playerName} is ranked ${selectionLabel}. Activate to remove this ranking.`
          : `${playerName} is not ranked. Activate to add this board to your ballot.`
      }
      onClick={() => {
        if (!disabled) onSelect();
      }}
      onKeyDown={handleKeyDown}
      className={`relative overflow-hidden rounded-2xl border bg-neutral-900/80 backdrop-blur-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 ${
        isSelected
          ? `${selectedBorderClass} ring-1 ring-inset ring-white/20`
          : "border-neutral-800"
      } ${
        disabled
          ? "opacity-80"
          : `cursor-pointer ${hoverBorder} active:scale-[0.995]`
      }`}
    >
      {selectionLabel && (
        <div
          className={`pointer-events-none absolute right-3 top-3 z-20 rounded-full px-3 py-1 text-xs font-black text-white shadow-lg ring-1 ring-white/30 ${selectionBadgeClass}`}
        >
          {selectionLabel}
        </div>
      )}
      {children}
    </article>
  );
}
