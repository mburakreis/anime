import { useEffect, useMemo, useRef, useState } from "react";
import { getPictures, getTopAnime } from "./jikan";
import type { Anime, Picture, UserEntry, WatchStatus } from "./types";
import {
  getAllEntries,
  getEntry,
  setRating as lsSetRating,
  setStatus as lsSetStatus,
} from "./storage";
import {
  fetchAuth,
  fetchList,
  fromMalStatus,
  updateStatus as malUpdateStatus,
  type AuthInfo,
  type MalListItem,
} from "./mal";

const STATUS_LABELS: Record<Exclude<WatchStatus, null>, string> = {
  watched: "İzledim",
  watching: "İzliyorum",
  plan: "İzleyeceğim",
  dropped: "Bıraktım",
};

function titleOfType(a: Anime, type: string): string | undefined {
  return a.titles.find((t) => t.type.toLowerCase() === type.toLowerCase())
    ?.title;
}

function romajiTitle(a: Anime): string {
  return titleOfType(a, "Default") ?? a.title;
}

function englishTitle(a: Anime): string | null {
  return a.title_english ?? titleOfType(a, "English") ?? null;
}

function japaneseTitle(a: Anime): string | null {
  return a.title_japanese ?? titleOfType(a, "Japanese") ?? null;
}

function malListToEntries(items: MalListItem[]): Record<string, UserEntry> {
  const out: Record<string, UserEntry> = {};
  for (const it of items) {
    out[it.mal_id] = {
      status: fromMalStatus(it.status),
      rating: it.score > 0 ? it.score : null,
      updatedAt: Date.parse(it.updated_at) || 0,
    };
  }
  return out;
}

export default function App() {
  const [list, setList] = useState<Anime[]>([]);
  const [page, setPage] = useState(1);
  const [loadingList, setLoadingList] = useState(false);
  const [index, setIndex] = useState(0);
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [auth, setAuth] = useState<AuthInfo | null>(null);
  const [entries, setEntries] = useState<Record<string, UserEntry>>(
    () => getAllEntries()
  );
  const [error, setError] = useState<string | null>(null);

  const current = list[index];
  const isAuthed = auth?.authenticated === true;

  useEffect(() => {
    fetchAuth()
      .then(setAuth)
      .catch(() => setAuth({ authenticated: false }));
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    let cancelled = false;
    fetchList()
      .then((items) => {
        if (cancelled) return;
        setEntries(malListToEntries(items));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    setError(null);
    getTopAnime(1)
      .then((data) => !cancelled && setList(data))
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoadingList(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!list.length) return;
    if (index < list.length - 5) return;
    if (loadingList) return;
    const next = page + 1;
    setLoadingList(true);
    getTopAnime(next)
      .then((more) => {
        setList((prev) => {
          const seen = new Set(prev.map((a) => a.mal_id));
          return [...prev, ...more.filter((a) => !seen.has(a.mal_id))];
        });
        setPage(next);
      })
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }, [index, list.length, page, loadingList]);

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    setPictures([]);
    getPictures(current.mal_id)
      .then((pics) => !cancelled && setPictures(pics))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [current?.mal_id]);

  const listLenRef = useRef(list.length);
  listLenRef.current = list.length;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA"))
        return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "j") {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, listLenRef.current - 1));
      } else if (
        e.key === "ArrowUp" ||
        e.key === "ArrowLeft" ||
        e.key === "k"
      ) {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const entry = useMemo<UserEntry>(() => {
    if (!current) return { status: null, rating: null, updatedAt: 0 };
    return entries[current.mal_id] ?? getEntry(current.mal_id);
  }, [current, entries]);

  async function onSetStatus(nextStatus: WatchStatus) {
    if (!current) return;
    const prev = entries[current.mal_id] ?? {
      status: null,
      rating: null,
      updatedAt: 0,
    };
    const updated: UserEntry = {
      ...prev,
      status: nextStatus,
      updatedAt: Date.now(),
    };
    setEntries((e) => ({ ...e, [current.mal_id]: updated }));

    if (isAuthed) {
      try {
        if (nextStatus === null && prev.rating == null) {
          await malUpdateStatus({ mal_id: current.mal_id, status: null });
        } else {
          await malUpdateStatus({
            mal_id: current.mal_id,
            status: nextStatus ?? "plan",
          });
        }
      } catch {}
    } else {
      lsSetStatus(current.mal_id, nextStatus);
    }
  }

  async function onSetRating(nextRating: number | null) {
    if (!current) return;
    const prev = entries[current.mal_id] ?? {
      status: null,
      rating: null,
      updatedAt: 0,
    };
    const updated: UserEntry = {
      ...prev,
      rating: nextRating,
      updatedAt: Date.now(),
    };
    setEntries((e) => ({ ...e, [current.mal_id]: updated }));

    if (isAuthed) {
      try {
        if (nextRating == null && prev.status == null) {
          await malUpdateStatus({ mal_id: current.mal_id, status: null });
        } else {
          await malUpdateStatus({
            mal_id: current.mal_id,
            status: prev.status ?? "plan",
            score: nextRating ?? 0,
          });
        }
      } catch {}
    } else {
      lsSetRating(current.mal_id, nextRating);
    }
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-400">
        Hata: {error}
      </div>
    );
  }

  if (!current) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-muted)]">
        Yükleniyor…
      </div>
    );
  }

  const cover =
    current.images?.webp?.large_image_url ??
    current.images?.jpg?.large_image_url ??
    current.images?.jpg?.image_url ??
    "";
  const extraPics = pictures
    .map((p) => p.webp?.large_image_url ?? p.jpg?.large_image_url)
    .filter((u): u is string => !!u && u !== cover)
    .slice(0, 3);

  const eng = englishTitle(current);
  const rom = romajiTitle(current);
  const jp = japaneseTitle(current);

  return (
    <div className="h-full w-full flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-panel)]">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-wide">
            <span className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-2)] bg-clip-text text-transparent">
              Anime Tracker
            </span>
          </h1>
          <span className="text-xs text-[var(--color-muted)]">
            {isAuthed ? "MAL sync" : "v0 · localStorage"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-[var(--color-muted)]">
          <span>
            {index + 1} / {list.length}
          </span>
          <div className="flex gap-1">
            <button
              className="px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-panel-2)] disabled:opacity-40"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              title="Önceki (↑ / ←)"
            >
              ↑
            </button>
            <button
              className="px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-panel-2)] disabled:opacity-40"
              disabled={index >= list.length - 1}
              onClick={() =>
                setIndex((i) => Math.min(list.length - 1, i + 1))
              }
              title="Sonraki (↓ / →)"
            >
              ↓
            </button>
          </div>
          {auth && (
            isAuthed ? (
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-text)]">
                  {auth.user.name}
                </span>
                <a
                  href="/api/auth/logout"
                  className="text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-panel-2)]"
                >
                  Çıkış
                </a>
              </div>
            ) : (
              <a
                href="/api/auth/login"
                className="text-xs px-3 py-1.5 rounded border border-[var(--color-accent)]/50 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
              >
                MAL ile giriş yap
              </a>
            )
          )}
        </div>
      </header>

      <main className="flex-1 min-h-0 grid grid-cols-[22rem_1fr_18rem] gap-4 p-4">
        <section className="min-h-0 flex flex-col gap-3">
          <div className="relative rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-panel)] flex-1 min-h-0">
            {cover && (
              <img
                src={cover}
                alt={rom}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
              {current.rank && (
                <span className="text-xs bg-black/60 backdrop-blur px-2 py-0.5 rounded">
                  #{current.rank}
                </span>
              )}
              {current.score && (
                <span className="text-xs bg-black/60 backdrop-blur px-2 py-0.5 rounded">
                  ★ {current.score}
                </span>
              )}
              {current.year && (
                <span className="text-xs bg-black/60 backdrop-blur px-2 py-0.5 rounded">
                  {current.year}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-xl font-semibold leading-tight line-clamp-2">
              {eng ?? rom}
            </div>
            {eng && eng !== rom && (
              <div className="text-sm text-[var(--color-muted)] leading-tight line-clamp-1">
                {rom}
              </div>
            )}
            {jp && (
              <div className="text-sm text-[var(--color-muted)] leading-tight line-clamp-1">
                {jp}
              </div>
            )}
          </div>
        </section>

        <section className="min-h-0 flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {current.type && (
              <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-panel-2)] border border-[var(--color-border)]">
                {current.type}
              </span>
            )}
            {current.episodes && (
              <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-panel-2)] border border-[var(--color-border)]">
                {current.episodes} bölüm
              </span>
            )}
            {current.status && (
              <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-panel-2)] border border-[var(--color-border)]">
                {current.status}
              </span>
            )}
            {current.genres.slice(0, 5).map((g) => (
              <span
                key={g.mal_id}
                className="text-xs px-2 py-0.5 rounded bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 text-[var(--color-accent)]"
              >
                {g.name}
              </span>
            ))}
          </div>

          <div className="flex-1 min-h-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 overflow-auto">
            <h2 className="text-sm uppercase tracking-wider text-[var(--color-muted)] mb-2">
              Synopsis
            </h2>
            <p className="text-[15px] leading-relaxed whitespace-pre-line">
              {current.synopsis ?? "Açıklama yok."}
            </p>
          </div>

          {extraPics.length > 0 && (
            <div className="grid grid-cols-3 gap-2 h-32">
              {extraPics.map((url) => (
                <div
                  key={url}
                  className="rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-panel)]"
                >
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="min-h-0 flex flex-col gap-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
            <div className="text-xs uppercase tracking-wider text-[var(--color-muted)] mb-2">
              Durum
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["watched", "watching", "plan", "dropped"] as const).map((s) => {
                const active = entry.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => onSetStatus(active ? null : s)}
                    className={[
                      "text-sm px-2 py-2 rounded-lg border transition",
                      active
                        ? "bg-[var(--color-accent)]/20 border-[var(--color-accent)] text-[var(--color-accent)]"
                        : "border-[var(--color-border)] hover:bg-[var(--color-panel-2)] text-[var(--color-text)]",
                    ].join(" ")}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                Puan
              </div>
              {entry.rating != null && (
                <button
                  className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  onClick={() => onSetRating(null)}
                >
                  temizle
                </button>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const active = entry.rating === n;
                return (
                  <button
                    key={n}
                    onClick={() => onSetRating(active ? null : n)}
                    className={[
                      "text-sm py-1.5 rounded-md border transition",
                      active
                        ? "bg-[var(--color-accent-2)]/20 border-[var(--color-accent-2)] text-[var(--color-accent-2)]"
                        : "border-[var(--color-border)] hover:bg-[var(--color-panel-2)]",
                    ].join(" ")}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            {entry.rating != null && (
              <div className="text-center text-2xl font-semibold mt-2">
                {entry.rating}
                <span className="text-sm text-[var(--color-muted)]">/10</span>
              </div>
            )}
          </div>

          <a
            href={current.url}
            target="_blank"
            rel="noreferrer"
            className="text-center text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] underline"
          >
            MyAnimeList'te aç ↗
          </a>

          <div className="mt-auto text-xs text-[var(--color-muted)] leading-relaxed">
            Tuşlar: <kbd className="px-1 border border-[var(--color-border)] rounded">↑</kbd>{" "}
            <kbd className="px-1 border border-[var(--color-border)] rounded">↓</kbd>{" "}
            ile gezinebilirsin.
          </div>
        </aside>
      </main>
    </div>
  );
}
