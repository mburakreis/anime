export type JikanTitle = {
  type: string;
  title: string;
};

export type JikanImage = {
  jpg?: { image_url?: string; large_image_url?: string };
  webp?: { image_url?: string; large_image_url?: string };
};

export type Anime = {
  mal_id: number;
  url: string;
  images: JikanImage;
  titles: JikanTitle[];
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  synopsis: string | null;
  score: number | null;
  rank: number | null;
  popularity: number | null;
  episodes: number | null;
  year: number | null;
  type: string | null;
  status: string | null;
  genres: { mal_id: number; name: string }[];
};

export type Picture = {
  jpg?: { image_url?: string; large_image_url?: string };
  webp?: { image_url?: string; large_image_url?: string };
};

export type WatchStatus = "watched" | "watching" | "plan" | "dropped" | null;

export type UserEntry = {
  status: WatchStatus;
  rating: number | null;
  updatedAt: number;
};
