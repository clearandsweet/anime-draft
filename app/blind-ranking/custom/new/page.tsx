"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { BlindRankingCount } from "../../../lib/blindRanking";
import type { CustomRanking } from "../../../lib/customRanking";
import { rememberSavedCustomRanking } from "../../../lib/customRankingIdentity";
import { readApiResponse } from "../../../lib/apiResponse";

type BuilderItem = {
  localId: string;
  title: string;
  imageId: string;
  imageUrl: string;
  uploading: boolean;
  error: string;
};

function blankItem(): BuilderItem {
  return {
    localId: crypto.randomUUID(),
    title: "",
    imageId: "",
    imageUrl: "",
    uploading: false,
    error: "",
  };
}

async function imageDataUrl(file: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error("Use a JPEG, PNG, or WebP picture.");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the picture.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.82)
  );
  if (!blob) throw new Error("This browser could not prepare the picture.");
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The picture could not be read."));
    reader.readAsDataURL(blob);
  });
}

export default function NewCustomRankingPage() {
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [playCount, setPlayCount] = useState<BlindRankingCount>(5);
  const [items, setItems] = useState<BuilderItem[]>(() => Array.from({ length: 5 }, blankItem));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function changePlayCount(count: BlindRankingCount) {
    setPlayCount(count);
    setItems((current) => {
      if (current.length >= count) return current;
      return [...current, ...Array.from({ length: count - current.length }, blankItem)];
    });
  }

  function updateItem(localId: string, patch: Partial<BuilderItem>) {
    setItems((current) =>
      current.map((item) => (item.localId === localId ? { ...item, ...patch } : item))
    );
  }

  async function upload(localId: string, file: File | undefined) {
    if (!file) return;
    updateItem(localId, { uploading: true, error: "" });
    try {
      const dataUrl = await imageDataUrl(file);
      const response = await fetch("/api/blind-ranking/custom/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await readApiResponse<{
        imageId?: string;
        imageUrl?: string;
        error?: string;
      }>(response);
      if (!response.ok || !data.imageId || !data.imageUrl) {
        throw new Error(data.error || "The picture could not be uploaded.");
      }
      updateItem(localId, {
        imageId: data.imageId,
        imageUrl: data.imageUrl,
        uploading: false,
        error: "",
      });
    } catch (caught) {
      updateItem(localId, {
        uploading: false,
        error: caught instanceof Error ? caught.message : "Upload failed.",
      });
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    const completeItems = items.filter((item) => item.title.trim() && item.imageId);
    if (items.some((item) => item.uploading)) {
      setError("Wait for every picture to finish uploading.");
      return;
    }
    if (completeItems.length < playCount) {
      setError(`Finish at least ${playCount} titled pictures.`);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/blind-ranking/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          creator,
          description,
          tags: tags.split(","),
          playCount,
          items: completeItems.map((item) => ({ title: item.title, imageId: item.imageId })),
        }),
      });
      const data = await readApiResponse<{
        ranking?: CustomRanking;
        manageKey?: string;
        error?: string;
      }>(response);
      if (!response.ok || !data.ranking || !data.manageKey) {
        throw new Error(data.error || "The ranking could not be saved.");
      }
      rememberSavedCustomRanking({
        id: data.ranking.id,
        slug: data.ranking.slug,
        manageKey: data.manageKey,
      });
      window.location.href = `/blind-ranking/custom/${data.ranking.slug}`;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The ranking could not be saved.");
      setSaving(false);
    }
  }

  return (
    <main className="blind-page custom-builder-page">
      <nav className="blind-nav">
        <Link href="/blind-ranking/custom">Custom Rankings</Link>
        <span>Creator</span>
      </nav>

      <header className="custom-builder-hero">
        <p className="blind-eyebrow">Build the surprise</p>
        <h1>Make your own<br />blind ranking.</h1>
        <p>Add more choices than the final list to give every player a different game.</p>
      </header>

      <form className="custom-builder-form" onSubmit={save}>
        <section className="custom-builder-details">
          <div className="blind-panel-heading">
            <span>01 · The premise</span>
            <h2>Name the argument</h2>
          </div>
          <div className="custom-form-grid">
            <label className="blind-field custom-wide-field">
              <span>Ranking name</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="Best magical girl transformations" required />
            </label>
            <label className="blind-field">
              <span>Creator name</span>
              <input value={creator} onChange={(event) => setCreator(event.target.value)} maxLength={40} placeholder="Your display name" required />
            </label>
            <label className="blind-field">
              <span>Tags · comma separated</span>
              <input value={tags} onChange={(event) => setTags(event.target.value)} maxLength={180} placeholder="anime, magical girls, openings" />
            </label>
            <label className="blind-field custom-wide-field">
              <span>Short description</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={320} placeholder="What should players rank?" />
            </label>
          </div>
          <fieldset className="custom-count-picker">
            <legend>Final list size</legend>
            {[5, 7, 10].map((count) => (
              <button
                key={count}
                type="button"
                aria-pressed={playCount === count}
                onClick={() => changePlayCount(count as BlindRankingCount)}
              >
                Top {count}
              </button>
            ))}
          </fieldset>
        </section>

        <section className="custom-builder-items">
          <div className="custom-items-heading">
            <div className="blind-panel-heading">
              <span>02 · The pool</span>
              <h2>Add the possibilities</h2>
              <p>At least {playCount}; up to 30. A random {playCount} appear each game.</p>
            </div>
            <strong>{items.length} / 30</strong>
          </div>

          <div className="custom-item-list">
            {items.map((item, index) => (
              <article className="custom-builder-item" key={item.localId}>
                <span className="custom-builder-number">{String(index + 1).padStart(2, "0")}</span>
                <label className={`custom-image-picker ${item.imageUrl ? "filled" : ""}`}>
                  {item.imageUrl ? (
                    // Uploaded artwork is served by the custom image route.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt="" />
                  ) : (
                    <span>{item.uploading ? "Uploading…" : "+ Picture"}</span>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={item.uploading || saving}
                    onChange={(event) => upload(item.localId, event.target.files?.[0])}
                  />
                </label>
                <label className="blind-field custom-item-title">
                  <span>Title</span>
                  <input
                    value={item.title}
                    onChange={(event) => updateItem(item.localId, { title: event.target.value })}
                    maxLength={80}
                    placeholder="Choice name"
                    required={index < playCount}
                  />
                  {item.error ? <small className="custom-upload-error">{item.error}</small> : null}
                </label>
                <button
                  className="custom-remove-item"
                  type="button"
                  disabled={items.length <= playCount || saving}
                  onClick={() => setItems((current) => current.filter((entry) => entry.localId !== item.localId))}
                  aria-label={`Remove item ${index + 1}`}
                >
                  ×
                </button>
              </article>
            ))}
          </div>

          {items.length < 30 ? (
            <button className="blind-secondary-action custom-add-item" type="button" onClick={() => setItems((current) => [...current, blankItem()])}>
              + Add another possibility
            </button>
          ) : null}
        </section>

        {error ? <p className="blind-error" role="alert">{error}</p> : null}
        <div className="custom-builder-submit">
          <p>Publishing makes this ranking searchable and playable by anyone.</p>
          <button className="blind-primary-action" type="submit" disabled={saving}>
            {saving ? "Publishing…" : "Publish ranking"}
          </button>
        </div>
      </form>
    </main>
  );
}
