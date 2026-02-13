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
  { title: "Madoka Visual Storytelling", href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDPq5RPoyMInaBZ9idSL75SA" },
  { title: "Disappearance of Haruhi Breakdown", href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDOzxDGCC0fsU3ylrBVZJyGI" },
  { title: "Adolescence of Utena Breakdown", href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDPzbE5SuzphfsMraEaR8wkO" },
  { title: "Ultimate Magical Girl Tier List", href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDMA8GGTS_XnywU5A9zGwhhW" },
  { title: "Sailor Moon Iceberg", href: "https://www.youtube.com/watch?v=2DIW7hdbs5U" },
];

const collections = [
  { name: "Panels and Interviews", href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDMHbzmb9FTCI-Wgchcj7Dzf" },
  { name: "One Shots - Visual Storytelling", href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDNXKKZYkHmnvIBLKpFbqnyp" },
  { name: "Madoka Magica Analysis", href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDPq5RPoyMInaBZ9idSL75SA" },
  { name: "Haruhi Analysis", href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDOzxDGCC0fsU3ylrBVZJyGI" },
  { name: "Utena Analysis", href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDPzbE5SuzphfsMraEaR8wkO" },
  { name: "Endless Eight: A Kyoani Podcast", href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDOBUxzX2U4c10Hj-MvRSg7V" },
];

const libraryVideos: LibraryVideo[] = [
  { id: "fUaCNM4S2gA", title: "NEW HARUHI SERIES? RUMOR MILL", category: "News & Commentary", series: "News", year: 2025 },
  { id: "I-SwXcmcs7s", title: "Nowhere on the Block (Full Album)", category: "Music & Side Quests", series: "Music", year: 2025 },
  { id: "0oue4w5VakM", title: "Why the Three Episode Rule is Stupid", category: "News & Commentary", series: "Critical Essays", year: 2025 },
  { id: "wt0ijqDf6F4", title: "Look Back: A Perfect Anime Film - Pt 1", category: "Visual Storytelling", series: "One Shots", year: 2025 },
  { id: "SJnaLOWaWtI", title: "Subjectivity and Objectivity in Anime Criticism", category: "Roundtables & Podcasts", series: "Discussion", year: 2025 },
  { id: "oTMfwJ3Fuco", title: "Analyzing DanDaDan's BEST Fight Scene", category: "Visual Storytelling", series: "One Shots", year: 2024 },
  { id: "2DIW7hdbs5U", title: "Exploring The Sailor Moon Iceberg", category: "Roundtables & Podcasts", series: "Sailor Moon", year: 2023 },
  { id: "K8ppIs1JFzA", title: "Revisiting the Sailor Moon Iceberg", category: "Roundtables & Podcasts", series: "Sailor Moon", year: 2024 },
  { id: "JOTl6wDiC70", title: "Thinking About Anime 102 (Otakon 2023)", category: "Panels & Interviews", series: "Convention Panel", year: 2023 },
  { id: "OQqyP9fBfTQ", title: "Thinking About Anime 101 (Otakon 2018)", category: "Panels & Interviews", series: "Convention Panel", year: 2018 },
  { id: "dV5LEqqKgzA", title: "PMMM Dialogue 1", category: "Visual Storytelling", series: "Madoka", year: 2020 },
  { id: "qfz_Gg1k1Wc", title: "Disappearance of Haruhi - Part 1", category: "Visual Storytelling", series: "Haruhi", year: 2016 },
  { id: "RrajGU8H4B4", title: "Adolescence of Utena - Part 1", category: "Visual Storytelling", series: "Utena", year: 2018 },
  { id: "NCqQZMUOyRY", title: "Ultimate Magical Girl Tier List - Part 1", category: "Roundtables & Podcasts", series: "Tier List", year: 2021 },
  { id: "vASu_bebCos", title: "Ultimate Magical Girl Tier List - Part 5", category: "Roundtables & Podcasts", series: "Tier List", year: 2022 },
];

const categories = [
  "All",
  "Visual Storytelling",
  "Panels & Interviews",
  "Roundtables & Podcasts",
  "News & Commentary",
  "Music & Side Quests",
] as const;

const songEmbed =
  "https://www.youtube.com/embed/I-SwXcmcs7s?autoplay=1&loop=1&playlist=I-SwXcmcs7s&controls=1";

export default function HomePage() {
  const [active, setActive] = useState<(typeof categories)[number]>("All");
  const [search, setSearch] = useState("");
  const [avatarSrc, setAvatarSrc] = useState("/kai-avatar.png");
  const [boomboxOn, setBoomboxOn] = useState(true);

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

  const recent = useMemo(() => [...libraryVideos].sort((a, b) => b.year - a.year).slice(0, 5), []);

  return (
    <main className="geo-page">
      {boomboxOn && (
        <div className="geo-boombox-player" aria-hidden>
          <iframe src={songEmbed} title="Nowhere on the Block autoplay" allow="autoplay; encrypted-media" />
        </div>
      )}

      <header className="geo-banner">
        <div className="geo-marquee-wrap">
          <p className="geo-marquee-line">
            ★ clearandsweet dot com ★ deep anime criticism ★ magical girl agenda ★
            clearandsweet dot com ★ deep anime criticism ★ magical girl agenda ★
          </p>
        </div>
        <h1 className="geo-title blink">CLEARANDSWEET / KAI ANDERSEN</h1>
        <p className="geo-tagline">Formal analysis. Hot takes. Extremely serious frame-by-frame nonsense.</p>
      </header>

      <div className="geo-columns">
        <section className="geo-main-col">
          <article className="geo-box geo-videos-first">
            <h2>Featured + Recent</h2>
            <div className="geo-link-cloud">
              {featured.map((item) => (
                <a key={item.title} href={item.href} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
              ))}
            </div>
            <div className="geo-recent-list">
              {recent.map((video) => (
                <a key={video.id} href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer">
                  {video.year} :: {video.title}
                </a>
              ))}
            </div>
          </article>

          <article className="geo-box">
            <h2>Playlists Portal</h2>
            <div className="geo-playlist-grid">
              {collections.map((collection) => (
                <a key={collection.name} href={collection.href} target="_blank" rel="noreferrer">
                  {collection.name}
                </a>
              ))}
            </div>
          </article>

          <article className="geo-box">
            <h2>Browse Video Database (Very 2002 Search Technology)</h2>
            <div className="geo-filters">
              <div className="geo-chip-row">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActive(category)}
                    className={`geo-chip ${active === category ? "active" : ""}`}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className="geo-search"
                placeholder="Search title or series"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="geo-video-grid">
              {filtered.map((video) => (
                <a key={video.id} className="geo-video-card" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer">
                  <Image
                    src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                    alt={video.title}
                    width={480}
                    height={360}
                    loading="lazy"
                  />
                  <div className="geo-video-meta">
                    <strong>{video.title}</strong>
                    <span>{video.category} • {video.series ?? "misc"} • {video.year}</span>
                  </div>
                </a>
              ))}
            </div>
          </article>
        </section>

        <aside className="geo-side-col">
          <article className="geo-box geo-draft-box">
            <h2 className="blink">ANIME DRAFT</h2>
            <p>The draft app is alive and hosted at animedraft.godisaloli.com.</p>
            <a className="geo-button" href="https://animedraft.godisaloli.com" target="_blank" rel="noreferrer">ENTER THE DRAFT</a>
            <a className="geo-button alt" href="https://animedraft.godisaloli.com/draft" target="_blank" rel="noreferrer">LOBBY ROOMS</a>
          </article>

          <article className="geo-box geo-avatar-box">
            <h2>Avatar Shrine</h2>
            <div className="geo-avatar-wrap">
              <Image
                src={avatarSrc}
                alt="Kai avatar"
                width={420}
                height={620}
                onError={() => setAvatarSrc("/turkey_outline.png")}
              />
            </div>
            <p className="geo-note">Drop your image into <code>public/kai-avatar.png</code> to replace fallback.</p>
          </article>

          <article className="geo-box">
            <h2>Blingee Controls</h2>
            <button className="geo-button" onClick={() => setBoomboxOn((v) => !v)}>
              {boomboxOn ? "STOP BOOMBOX" : "START BOOMBOX"}
            </button>
            <a className="geo-button alt" href="https://suno.com/playlist/b4ac130d-3ccd-46f2-9bf6-9f79d8271542" target="_blank" rel="noreferrer">SUNO PLAYLIST</a>
            <div className="geo-links-stack">
              <a href="https://www.youtube.com/@clearandsweet" target="_blank" rel="noreferrer">YouTube</a>
              <a href="https://x.com/clearandsweet" target="_blank" rel="noreferrer">Twitter/X</a>
              <a href="https://bsky.app/profile/clearandsweet.bsky.social" target="_blank" rel="noreferrer">Bluesky</a>
              <a href="https://animesummit.net" target="_blank" rel="noreferrer">Anime Summit</a>
            </div>
          </article>
        </aside>
      </div>
    </main>
  );
}
