"use client";

export type DraftPreset = "classic" | "blitz" | "chaos";

const PRESETS: Array<{
  id: DraftPreset;
  name: string;
  eyebrow: string;
  description: string;
}> = [
  {
    id: "classic",
    name: "Classic",
    eyebrow: "5 min · full board",
    description: "Standard full-board draft.",
  },
  {
    id: "blitz",
    name: "Blitz",
    eyebrow: "60 sec · 6 random slots",
    description: "Short, fast draft.",
  },
  {
    id: "chaos",
    name: "Chaos",
    eyebrow: "90 sec · 10 random slots",
    description: "Random category draft.",
  },
];

type Props = {
  value: DraftPreset;
  onChange: (preset: DraftPreset) => void;
  accent: "fuchsia" | "red";
};

export function DraftPresetPicker({ value, onChange, accent }: Props) {
  const activeClass =
    accent === "fuchsia"
      ? "border-fuchsia-400 bg-fuchsia-500/10 ring-fuchsia-400/20"
      : "border-red-400 bg-red-500/10 ring-red-400/20";
  const eyebrowClass = accent === "fuchsia" ? "text-fuchsia-300" : "text-red-300";

  return (
    <fieldset className="club-preset-picker">
      <legend className="text-xs uppercase tracking-[0.18em] text-neutral-400 mb-3">
        Format
      </legend>
      <div className="grid gap-3 lg:grid-cols-3">
        {PRESETS.map((preset) => {
          const selected = value === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(preset.id)}
              className={`rounded-xl border p-4 text-left transition ${
                selected
                  ? `${activeClass} ring-4`
                  : "border-neutral-800 bg-neutral-950/70 hover:border-neutral-600 hover:bg-neutral-900"
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-semibold text-white">{preset.name}</span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    selected ? "bg-emerald-400" : "bg-neutral-700"
                  }`}
                />
              </span>
              <span className={`mt-1 block text-[11px] uppercase tracking-wide ${eyebrowClass}`}>
                {preset.eyebrow}
              </span>
              <span className="mt-2 block text-xs leading-relaxed text-neutral-400">
                {preset.description}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
