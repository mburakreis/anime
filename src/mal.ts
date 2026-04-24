import type { WatchStatus } from "./types";

export type MalStatus =
  | "watching"
  | "completed"
  | "on_hold"
  | "dropped"
  | "plan_to_watch";

export type MalListItem = {
  mal_id: number;
  status: MalStatus;
  score: number;
  updated_at: string;
};

export type MalUser = { name: string; picture?: string };

export type AuthInfo =
  | { authenticated: false }
  | { authenticated: true; user: MalUser };

const STATUS_TO_MAL: Record<Exclude<WatchStatus, null>, MalStatus> = {
  watched: "completed",
  watching: "watching",
  plan: "plan_to_watch",
  dropped: "dropped",
};

const MAL_TO_STATUS: Record<MalStatus, Exclude<WatchStatus, null>> = {
  completed: "watched",
  watching: "watching",
  plan_to_watch: "plan",
  dropped: "dropped",
  on_hold: "plan",
};

export function toMalStatus(s: Exclude<WatchStatus, null>): MalStatus {
  return STATUS_TO_MAL[s];
}

export function fromMalStatus(s: MalStatus): Exclude<WatchStatus, null> {
  return MAL_TO_STATUS[s];
}

export async function fetchAuth(): Promise<AuthInfo> {
  const r = await fetch("/api/auth/me", { credentials: "same-origin" });
  if (!r.ok) return { authenticated: false };
  return r.json();
}

export async function fetchList(): Promise<MalListItem[]> {
  const r = await fetch("/api/mal/list", { credentials: "same-origin" });
  if (!r.ok) return [];
  const data = (await r.json()) as { items: MalListItem[] };
  return data.items;
}

export async function updateStatus(input: {
  mal_id: number;
  status?: WatchStatus;
  score?: number | null;
}): Promise<void> {
  if (input.status === null && input.score === undefined) {
    const r = await fetch(`/api/mal/status?mal_id=${input.mal_id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!r.ok) throw new Error(`MAL delete failed (${r.status})`);
    return;
  }
  const body: Record<string, unknown> = { mal_id: input.mal_id };
  if (input.status !== undefined) {
    body.status = input.status === null ? undefined : toMalStatus(input.status);
  }
  if (input.score !== undefined) body.score = input.score ?? 0;
  const r = await fetch("/api/mal/status", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`MAL update failed (${r.status})${text ? `: ${text}` : ""}`);
  }
}
