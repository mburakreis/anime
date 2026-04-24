import type { Anime, Picture } from "./types";

const BASE = "https://api.jikan.moe/v4";

async function jfetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Jikan ${res.status}: ${path}`);
  return res.json();
}

export async function getTopAnime(page = 1): Promise<Anime[]> {
  const data = await jfetch<{ data: Anime[] }>(
    `/top/anime?page=${page}&limit=25&filter=bypopularity`
  );
  return data.data;
}

export async function getPictures(malId: number): Promise<Picture[]> {
  const data = await jfetch<{ data: Picture[] }>(`/anime/${malId}/pictures`);
  return data.data;
}
