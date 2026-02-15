import Link from "next/link";

const featureCards = [
  {
    title: "Snake Draft Engine",
    desc: "Turn order, timer, pause/resume, undo, and finish flow for live rooms.",
  },
  {
    title: "Category Modes",
    desc: "Play with default categories or random slot pools for chaotic drafts.",
  },
  {
    title: "Room Management",
    desc: "Per-lobby management keys, stale-room cleanup, and quick room browser.",
  },
  {
    title: "Voting + Export",
    desc: "Post-draft voting pages and downloadable board snapshots for sharing.",
  },
];

export default function AnimeDraftLandingPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="rounded-3xl border border-cyan-400/30 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.22),transparent_45%),radial-gradient(circle_at_90%_10%,rgba(45,212,191,0.15),transparent_40%),linear-gradient(150deg,#0a1328,#060912_60%)] p-8 shadow-[0_0_45px_rgba(56,189,248,0.22)]">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/90">animedraft.godisaloli.com</p>
          <h1 className="mt-2 text-4xl font-extrabold leading-tight sm:text-5xl">
            Anime Draft
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-neutral-300 sm:text-base">
            Build rooms, draft characters in real time, and settle arguments like
            adults with structured voting. This is the dedicated home for the
            multiplayer draft app.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/draft"
              className="rounded-xl border border-cyan-300/70 bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200"
            >
              Open Lobby Hub
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold hover:bg-neutral-800"
            >
              Back to Main Site
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {featureCards.map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-neutral-800 bg-neutral-900/75 p-5"
            >
              <h2 className="text-lg font-bold text-white">{card.title}</h2>
              <p className="mt-2 text-sm text-neutral-300">{card.desc}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

