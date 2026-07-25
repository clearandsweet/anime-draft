import Image from "next/image";

type DraftSearchResultCardProps = {
  character: {
    name: {
      full: string;
      native?: string;
    };
    image: {
      large: string;
    };
  };
  draftType: "anime" | "pokemon";
  metadata: string;
  onSelect: () => void;
};

export function DraftSearchResultCard({
  character,
  draftType,
  metadata,
  onSelect,
}: DraftSearchResultCardProps) {
  const accentClasses =
    draftType === "anime"
      ? "focus-visible:border-fuchsia-400 focus-visible:ring-fuchsia-400/40"
      : "focus-visible:border-red-400 focus-visible:ring-red-400/40";
  const resultType = draftType === "anime" ? "anime character" : "Pokémon";

  return (
    <button
      type="button"
      aria-label={`Choose ${character.name.full}, ${resultType}`}
      onClick={onSelect}
      className={`group flex min-h-24 w-full gap-3 rounded-xl border border-neutral-700 bg-neutral-800/40 p-2.5 text-left transition hover:border-neutral-500 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 ${accentClasses}`}
    >
      <Image
        src={character.image.large}
        alt={`${character.name.full} portrait`}
        width={64}
        height={80}
        unoptimized
        className={`shrink-0 rounded-lg bg-neutral-950 ${
          draftType === "anime"
            ? "h-20 w-16 object-cover"
            : "h-16 w-16 object-contain"
        }`}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className="truncate text-sm font-bold text-white"
          title={character.name.full}
        >
          {character.name.full}
        </span>
        {character.name.native && (
          <span className="truncate text-[11px] text-neutral-400">
            {character.name.native}
          </span>
        )}
        <span className="mt-1 text-[11px] text-neutral-500">{metadata}</span>
        <span className="mt-auto pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500 transition group-hover:text-neutral-300 group-focus-visible:text-white">
          Choose
        </span>
      </span>
    </button>
  );
}
