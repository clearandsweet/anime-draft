"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

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

type FeedVideo = {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  url: string;
};

type TweetItem = {
  id: string;
  text: string;
  url: string;
  publishedAt: string;
};

const featured = [
  {
    title: "Madoka Magica Analysis - Visual Storytelling",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDPq5RPoyMInaBZ9idSL75SA",
    blurb: "Scene-by-scene close reading of PMMM's visual language and thematic architecture.",
  },
  {
    title: "Disappearance of Haruhi Suzumiya Analysis",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDOzxDGCC0fsU3ylrBVZJyGI",
    blurb: "Deep breakdown of KyoAni craft, framing, and narrative motif design.",
  },
  {
    title: "Adolescence of Utena Analysis",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDPzbE5SuzphfsMraEaR8wkO",
    blurb: "Formal critical interpretation of symbolism, identity, and revolution.",
  },
  {
    title: "The Ultimate Magical Girl Tier List",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDMA8GGTS_XnywU5A9zGwhhW",
    blurb: "Multi-part collaborative map of magical girl genre history and quality.",
  },
  {
    title: "Sailor Moon Iceberg",
    href: "https://www.youtube.com/watch?v=2DIW7hdbs5U",
    blurb: "Lore archaeology, references, and fandom deep cuts.",
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
    name: "Madoka Magica Analysis",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDPq5RPoyMInaBZ9idSL75SA",
  },
  {
    name: "Haruhi Analysis",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDOzxDGCC0fsU3ylrBVZJyGI",
  },
  {
    name: "Utena Analysis",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDPzbE5SuzphfsMraEaR8wkO",
  },
  {
    name: "Endless Eight: A Kyoani Podcast",
    href: "https://www.youtube.com/playlist?list=PLrHHYqiUeuDOBUxzX2U4c10Hj-MvRSg7V",
  },
];

const curatedVideos: LibraryVideo[] = [
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
    id: "RrajGU8H4B4",
    title: "Adolescence of Utena - Part 1",
    category: "Visual Storytelling",
    series: "Utena Analysis",
    year: 2018,
  },
  {
    id: "NCqQZMUOyRY",
    title: "The Ultimate Magical Girl Tier List - Part 1",
    category: "Roundtables & Podcasts",
    series: "Tier List Project",
    year: 2021,
  },
  {
    id: "SJnaLOWaWtI",
    title: "Subjectivity and Objectivity in Anime Criticism",
    category: "Roundtables & Podcasts",
    series: "Discussion",
    year: 2025,
  },
  {
    id: "JOTl6wDiC70",
    title: "Thinking About Anime 102 (Otakon 2023)",
    category: "Panels & Interviews",
    series: "Convention Panel",
    year: 2023,
  },
  {
    id: "fUaCNM4S2gA",
    title: "Wait... NEW HARUHI SERIES? RUMOR MILL",
    category: "News & Commentary",
    series: "News",
    year: 2025,
  },
  {
    id: "I-SwXcmcs7s",
    title: "Nowhere on the Block (Full Album)",
    category: "Music & Side Quests",
    series: "Music",
    year: 2025,
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

function parseYear(publishedAt: string) {
  const d = new Date(publishedAt);
  return Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
}

function formatTimestamp(iso: string | null) {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function HomePage() {
  const [active, setActive] = useState<(typeof categories)[number]>("Visual Storytelling");
  const [search, setSearch] = useState("");
  const [latestFeed, setLatestFeed] = useState<FeedVideo[]>([]);
  const [latestFetchedAt, setLatestFetchedAt] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [tweets, setTweets] = useState<TweetItem[]>([]);
  const [tweetsLoading, setTweetsLoading] = useState(false);

  async function fetchLatest() {
    try {
      setFeedLoading(true);
      const res = await fetch("/api/youtube/latest", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) return;
      const videos = Array.isArray(data.videos) ? (data.videos as FeedVideo[]) : [];
      setLatestFeed(videos);
      setLatestFetchedAt(typeof data.fetchedAt === "string" ? data.fetchedAt : new Date().toISOString());
    } finally {
      setFeedLoading(false);
    }
  }

  useEffect(() => {
    fetchLatest();
    fetchTweets();
  }, []);

  async function fetchTweets() {
    try {
      setTweetsLoading(true);
      const res = await fetch("/api/twitter/latest", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) return;
      const nextTweets = Array.isArray(data.tweets) ? (data.tweets as TweetItem[]) : [];
      setTweets(nextTweets);
    } catch {
      // non-blocking
    } finally {
      setTweetsLoading(false);
    }
  }

  const mergedVideos = useMemo(() => {
    const feedAsLibrary: LibraryVideo[] = latestFeed.map((video) => ({
      id: video.id,
      title: video.title,
      category: "News & Commentary",
      series: "Latest Uploads",
      year: parseYear(video.publishedAt),
    }));

    const map = new Map<string, LibraryVideo>();
    for (const video of feedAsLibrary) map.set(video.id, video);
    for (const video of curatedVideos) {
      if (!map.has(video.id)) map.set(video.id, video);
    }
    return Array.from(map.values());
  }, [latestFeed]);

  const filtered = useMemo(() => {
    return mergedVideos.filter((video) => {
      const matchesCategory = active === "All" || video.category === active;
      const q = search.trim().toLowerCase();
      const matchesQuery =
        q.length === 0 ||
        video.title.toLowerCase().includes(q) ||
        (video.series && video.series.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [mergedVideos, active, search]);

  return (
    <main className="site-page-v2">
      <section className="v2-top-grid">
        <article className="v2-panel v2-main-hero">
          <p className="v2-kicker">Clearandsweet / Kai Andersen</p>
          <h1>Anime criticism built on formal analysis.</h1>
          <p>
            Visual storytelling breakdowns, convention panels, interviews, and long-form critical work focused on anime craft.
          </p>
          <div className="v2-actions">
            <a href="https://www.youtube.com/@clearandsweet" target="_blank" rel="noreferrer" className="v2-btn primary">
              YouTube Channel
            </a>
            <a href="https://suno.com/playlist/b4ac130d-3ccd-46f2-9bf6-9f79d8271542" target="_blank" rel="noreferrer" className="v2-btn ghost">
              Suno Playlist
            </a>
          </div>
        </article>

        <article className="v2-panel v2-draft-feature">
          <p className="v2-kicker">Featured App</p>
          <h2>Anime Draft</h2>
          <p>Live multiplayer character draft rooms with timer, voting, and exports.</p>
          <div className="v2-actions stack">
            <a href="https://animedraft.godisaloli.com/draft" target="_blank" rel="noreferrer" className="v2-btn primary">
              Create Your Own Anime Character Draft
            </a>
          </div>
        </article>
      </section>

      <section className="v2-section">
        <div className="v2-section-head">
          <h2>What People Say</h2>
        </div>
        {tweetsLoading ? (
          <p className="v2-empty">Twitter/X feed loading...</p>
        ) : tweets.length === 0 ? (
          <p className="v2-empty">No composed tweets available right now.</p>
        ) : (
          <div className="v2-tweet-marquee" aria-label="Recent tweets">
            <div className="v2-tweet-track">
              {[...tweets, ...tweets].map((tweet, index) => (
                <a
                  key={`${tweet.id}-${index}`}
                  href={tweet.url}
                  target="_blank"
                  rel="noreferrer"
                  className="v2-tweet-chip"
                >
                  <span>{tweet.text}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="v2-section">
        <div className="v2-section-head">
          <h2>Latest Uploads</h2>
          <div className="v2-feed-meta">
            <span>Last sync: {formatTimestamp(latestFetchedAt)}</span>
            <button onClick={fetchLatest} disabled={feedLoading} className="v2-refresh-btn">
              {feedLoading ? "Refreshing..." : "Refresh feed"}
            </button>
          </div>
        </div>

        <div className="v2-video-grid latest">
          {latestFeed.length === 0 ? (
            <p className="v2-empty">No live feed data yet. Click refresh.</p>
          ) : (
            latestFeed.slice(0, 8).map((video) => (
              <a key={video.id} className="v2-video-card" href={video.url} target="_blank" rel="noreferrer">
                <Image src={video.thumbnail} alt={video.title} width={480} height={360} loading="lazy" />
                <div className="v2-video-meta">
                  <h3>{video.title}</h3>
                  <p>{formatTimestamp(video.publishedAt)}</p>
                </div>
              </a>
            ))
          )}
        </div>
      </section>

      <section className="v2-section">
        <div className="v2-section-head">
          <h2>Featured Series</h2>
        </div>
        <div className="v2-feature-grid">
          {featured.map((item) => (
            <a key={item.title} className="v2-feature-card" href={item.href} target="_blank" rel="noreferrer">
              <h3>{item.title}</h3>
              <p>{item.blurb}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="v2-section v2-split">
        <article className="v2-panel">
          <div className="v2-section-head compact">
            <h2>Browse Library</h2>
          </div>
          <div className="v2-chip-row">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActive(category)}
                className={`v2-chip ${active === category ? "active" : ""}`}
              >
                {category}
              </button>
            ))}
          </div>
          <input
            type="text"
            className="v2-search"
            placeholder="Search title or series"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="v2-video-grid compact">
            {filtered.map((video) => (
              <a key={video.id} className="v2-video-card" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer">
                <Image
                  src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                  alt={video.title}
                  width={480}
                  height={360}
                  loading="lazy"
                />
                <div className="v2-video-meta">
                  <h3>{video.title}</h3>
                  <p>{video.category} | {video.series ?? "misc"}</p>
                </div>
              </a>
            ))}
          </div>
        </article>

        <article className="v2-panel">
          <div className="v2-section-head compact">
            <h2>Playlists + Links</h2>
          </div>
          <div className="v2-link-list">
            {collections.map((collection) => (
              <a key={collection.name} href={collection.href} target="_blank" rel="noreferrer">
                {collection.name}
              </a>
            ))}
          </div>
          <div className="v2-link-list minor">
            <a href="https://x.com/clearandsweet" target="_blank" rel="noreferrer">Twitter / X</a>
            <a href="https://bsky.app/profile/clearandsweet.bsky.social" target="_blank" rel="noreferrer">Bluesky</a>
            <a href="https://animesummit.net" target="_blank" rel="noreferrer">Anime Summit (Partner & Guest)</a>
          </div>
        </article>
      </section>
    </main>
  );
}
