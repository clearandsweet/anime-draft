"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type LibraryVideo = {
  id: string;
  title: string;
  category:
    | "Visual Storytelling"
    | "Panels & Interviews"
    | "Roundtables & Podcasts"
    | "News & Commentary"
    | "Music & Side Quests";
  series?: string;
  year: number;
};

const featured = [
  {
    title: "Madoka Magica Analysis - Visual Storytelling",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDPq5RPoyMInaBZ9idSL75SA",
    blurb: "A deep, scene-by-scene close reading of PMMM and its themes.",
    tag: "Flagship Series",
  },
  {
    title: "Disappearance of Haruhi Suzumiya Analysis",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDOzxDGCC0fsU3ylrBVZJyGI",
    blurb: "Visual language, motif tracking, and KyoAni craftsmanship in detail.",
    tag: "Visual Storytelling",
  },
  {
    title: "Adolescence of Utena Analysis",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDPzbE5SuzphfsMraEaR8wkO",
    blurb: "A formal critical breakdown of symbolism, framing, and ideology.",
    tag: "Visual Storytelling",
  },
  {
    title: "The Ultimate Magical Girl Tier List",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDMA8GGTS_XnywU5A9zGwhhW",
    blurb: "A multi-part collaborative ranking and historical conversation.",
    tag: "Community Project",
  },
  {
    title: "Exploring The Sailor Moon Iceberg",
    href: "https://www.youtube.com/watch?v=2DIW7hdbs5U",
    blurb: "Deep lore, historical context, and fandom archaeology.",
    tag: "Sailor Moon",
  },
];

const collections = [
  {
    name: "Panels and Interviews",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDMHbzmb9FTCI-Wgchcj7Dzf",
  },
  {
    name: "One Shots - Visual Storytelling",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDNXKKZYkHmnvIBLKpFbqnyp",
  },
  {
    name: "Madoka Magica Analysis - Visual Storytelling",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDPq5RPoyMInaBZ9idSL75SA",
  },
  {
    name: "Disappearance of Haruhi Suzumiya Analysis",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDOzxDGCC0fsU3ylrBVZJyGI",
  },
  {
    name: "Adolescence of Utena Analysis",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDPzbE5SuzphfsMraEaR8wkO",
  },
  {
    name: "The Ultimate Magical Girl Tier List",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDMA8GGTS_XnywU5A9zGwhhW",
  },
  {
    name: "In Defense Of",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDMEQXyv3VUsANgXmOWlNuj7",
  },
  {
    name: "Endless Eight: A Kyoani Podcast",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDOBUxzX2U4c10Hj-MvRSg7V",
  },
];

const libraryVideos: LibraryVideo[] = [
  {
    id: "dV5LEqqKgzA",
    title: "Visual Storytelling - Breaking Down PMMM - Dialogue 1",
    category: "Visual Storytelling",
    series: "Madoka Magica Analysis",
    year: 2020,
  },
  {
    id: "gQjoORWhc_4",
    title: "Visual Storytelling - Breaking Down PMMM - Final Dialogue",
    category: "Visual Storytelling",
    series: "Madoka Magica Analysis",
    year: 2021,
  },
  {
    id: "qfz_Gg1k1Wc",
    title: "Disappearance of Haruhi Suzumiya - Part 1",
    category: "Visual Storytelling",
    series: "Haruhi Analysis",
    year: 2016,
  },
  {
    id: "fj7eTXc1bVs",
    title: "Disappearance of Haruhi Suzumiya - Part 7",
    category: "Visual Storytelling",
    series: "Haruhi Analysis",
    year: 2016,
  },
  {
    id: "RrajGU8H4B4",
    title: "Adolescence of Utena - Part 1",
    category: "Visual Storytelling",
    series: "Utena Analysis",
    year: 2018,
  },
  {
    id: "My1Y-yVO5Qw",
    title: "Adolescence of Utena - Part Final",
    category: "Visual Storytelling",
    series: "Utena Analysis",
    year: 2019,
  },
  {
    id: "wt0ijqDf6F4",
    title: "Visual Storytelling - Look Back: A Perfect Anime Film - Pt 1",
    category: "Visual Storytelling",
    series: "One Shots",
    year: 2025,
  },
  {
    id: "oTMfwJ3Fuco",
    title: "Visual Storytelling - Analyzing DanDaDan's BEST Fight Scene",
    category: "Visual Storytelling",
    series: "One Shots",
    year: 2024,
  },
  {
    id: "NCqQZMUOyRY",
    title: "The Ultimate Magical Girl Tier List - Part 1",
    category: "Roundtables & Podcasts",
    series: "Tier List Project",
    year: 2021,
  },
  {
    id: "vASu_bebCos",
    title: "The Ultimate Magical Girl Tier List - Part 5",
    category: "Roundtables & Podcasts",
    series: "Tier List Project",
    year: 2022,
  },
  {
    id: "2DIW7hdbs5U",
    title: "Exploring The Sailor Moon Iceberg",
    category: "Roundtables & Podcasts",
    series: "Sailor Moon",
    year: 2023,
  },
  {
    id: "K8ppIs1JFzA",
    title: "Revisiting the Sailor Moon Iceberg",
    category: "Roundtables & Podcasts",
    series: "Sailor Moon",
    year: 2024,
  },
  {
    id: "SJnaLOWaWtI",
    title: "Subjectivity and Objectivity in Anime Criticism",
    category: "Roundtables & Podcasts",
    series: "Discussion",
    year: 2025,
  },
  {
    id: "WqvrqDggTPY",
    title: "Are Magical Girl Reboots Actually Overrated?",
    category: "Roundtables & Podcasts",
    series: "Discussion",
    year: 2024,
  },
  {
    id: "OQqyP9fBfTQ",
    title: "Thinking About Anime 101 (Otakon 2018)",
    category: "Panels & Interviews",
    series: "Convention Panel",
    year: 2018,
  },
  {
    id: "JOTl6wDiC70",
    title: "Thinking About Anime 102 (Otakon 2023)",
    category: "Panels & Interviews",
    series: "Convention Panel",
    year: 2023,
  },
  {
    id: "6lonGrgg1lE",
    title: "Missing the Ma[rk]doka: Dark Magical Girls Post 2011",
    category: "Panels & Interviews",
    series: "Katsucon Panel",
    year: 2019,
  },
  {
    id: "7c24e3I9CdI",
    title: "Interview with a Professor of Anime 3",
    category: "Panels & Interviews",
    series: "Interview",
    year: 2017,
  },
  {
    id: "E78y1THX960",
    title: "Interview with a College Professor who Taught Magical Girl Media",
    category: "Panels & Interviews",
    series: "Interview",
    year: 2016,
  },
  {
    id: "fUaCNM4S2gA",
    title: "Wait... NEW HARUHI SERIES? RUMOR MILL",
    category: "News & Commentary",
    series: "News",
    year: 2025,
  },
  {
    id: "0oue4w5VakM",
    title: "Why the Three Episode Rule is Stupid",
    category: "News & Commentary",
    series: "Critical Essays",
    year: 2025,
  },
  {
    id: "uPIX-4hhnVs",
    title: "An Official Precure Site is Hosting WHAT???",
    category: "News & Commentary",
    series: "News",
    year: 2025,
  },
  {
    id: "DrP--7ELJPM",
    title: "Walpurgisnacht Rising: Release Date Confirmed + Trailer",
    category: "News & Commentary",
    series: "Madoka News",
    year: 2025,
  },
  {
    id: "TiwfDde2oh0",
    title: "NEW MADOKA FILM INFO + 2nd Trailer Analysis",
    category: "News & Commentary",
    series: "Madoka News",
    year: 2024,
  },
  {
    id: "odHNppjTQyU",
    title: "4th MADOKA FILM INFO RELEASED! Trailer Analysis",
    category: "News & Commentary",
    series: "Madoka News",
    year: 2023,
  },
  {
    id: "2k1QN1FpklQ",
    title: "Paying my Respects at the Kyoto Animation Memorial",
    category: "News & Commentary",
    series: "Travel / Reflection",
    year: 2024,
  },
  {
    id: "I-SwXcmcs7s",
    title: "Nowhere on the Block (Full Album)",
    category: "Music & Side Quests",
    series: "Music",
    year: 2025,
  },
  {
    id: "jqWZj2hRyyA",
    title: "Fear Not This Night [Madoka Magica AMV]",
    category: "Music & Side Quests",
    series: "AMV",
    year: 2024,
  },
  {
    id: "c0-pGImNmuU",
    title: "Why I Didn't Cry Playing Clair Obscur: Expedition 33",
    category: "Music & Side Quests",
    series: "Side Quest",
    year: 2025,
  },
  {
    id: "QVoNUq077xk",
    title: "The Uncanny at the Heart of Guilty Gear",
    category: "Music & Side Quests",
    series: "Side Quest",
    year: 2024,
  },
];

const categories = [
  "All",
  "Visual Storytelling",
  "Panels & Interviews",
  "Roundtables & Podcasts",
  "News & Commentary",
  "Music & Side Quests",
] as const;

export default function HomePage() {
  const [active, setActive] = useState<(typeof categories)[number]>("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return libraryVideos.filter((video) => {
      const matchesCategory = active === "All" || video.category === active;
      const query = search.trim().toLowerCase();
      const matchesQuery =
        query.length === 0 ||
        video.title.toLowerCase().includes(query) ||
        (video.series && video.series.toLowerCase().includes(query));

      return matchesCategory && matchesQuery;
    });
  }, [active, search]);

  return (
    <main className="kai-page">
      <section className="hero fade-in-up">
        <p className="eyebrow">Clearandsweet / Kai Andersen</p>
        <h1>Formal critical analysis for anime that deserves close reading.</h1>
        <p className="hero-copy">
          I break down anime scene by scene, tracing visual language, thematic
          architecture, and directorial intent. Essays, panels, interviews, and
          long-form conversations live here.
        </p>
        <div className="hero-actions">
          <a
            className="button primary"
            href="https://www.youtube.com/@clearandsweet"
            target="_blank"
            rel="noreferrer"
          >
            YouTube Channel
          </a>
          <a
            className="button ghost"
            href="https://suno.com/playlist/b4ac130d-3ccd-46f2-9bf6-9f79d8271542"
            target="_blank"
            rel="noreferrer"
          >
            Suno Album Playlist
          </a>
        </div>
      </section>

      <section className="section fade-in-up" style={{ animationDelay: "120ms" }}>
        <div className="section-head">
          <h2>Featured Projects</h2>
        </div>
        <div className="feature-grid">
          {featured.map((item) => (
            <a
              key={item.title}
              className="feature-card"
              href={item.href}
              target="_blank"
              rel="noreferrer"
            >
              <span className="chip">{item.tag}</span>
              <h3>{item.title}</h3>
              <p>{item.blurb}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="section fade-in-up" style={{ animationDelay: "200ms" }}>
        <div className="section-head">
          <h2>Browse Video Library</h2>
          <p>Sort by category or search by title/series.</p>
        </div>
        <div className="library-controls">
          <div className="chip-row">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActive(category)}
                className={`chip-button ${active === category ? "active" : ""}`}
              >
                {category}
              </button>
            ))}
          </div>
          <input
            type="text"
            className="search-input"
            placeholder="Search titles, series, topics..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="video-grid">
          {filtered.map((video) => (
            <a
              key={video.id}
              className="video-card"
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noreferrer"
            >
              <Image
                src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                alt={video.title}
                width={480}
                height={360}
                loading="lazy"
              />
              <div className="video-meta">
                <p className="video-category">{video.category}</p>
                <h3>{video.title}</h3>
                <p>{video.series ? `${video.series} • ${video.year}` : video.year}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="section split fade-in-up" style={{ animationDelay: "280ms" }}>
        <article className="panel">
          <h2>Collections</h2>
          <p>Jump straight into playlists and long-running series.</p>
          <div className="link-list">
            {collections.map((collection) => (
              <a key={collection.name} href={collection.href} target="_blank" rel="noreferrer">
                {collection.name}
              </a>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Elsewhere</h2>
          <div className="link-list">
            <a href="https://x.com/clearandsweet" target="_blank" rel="noreferrer">
              Twitter / X
            </a>
            <a href="https://bsky.app/profile/clearandsweet.bsky.social" target="_blank" rel="noreferrer">
              Bluesky
            </a>
            <p className="inline-handle">
              Discord: <strong>clearandsweet</strong>
            </p>
            <a href="https://animesummit.net" target="_blank" rel="noreferrer">
              Anime Summit (Partner & Guest)
            </a>
          </div>
        </article>
      </section>

      <section className="section fade-in-up" style={{ animationDelay: "360ms" }}>
        <article className="draft-feature">
          <div>
            <p className="eyebrow">Site Feature</p>
            <h2>Anime Draft</h2>
            <p>
              The original multiplayer anime draft app is still live. Build
              lineups with friends, run timed rounds, and settle scores.
            </p>
          </div>
          <div className="hero-actions">
            <a
              className="button primary"
              href="https://animedraft.godisaloli.com"
              target="_blank"
              rel="noreferrer"
            >
              Open Anime Draft
            </a>
            <a
              className="button ghost"
              href="/draft"
            >
              Manage Lobbies
            </a>
          </div>
        </article>
      </section>
    </main>
  );
}
