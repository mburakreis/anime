import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFreshAccessToken, malFetch } from "../_lib";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = await getFreshAccessToken(req, res);
  if (!token) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  if (req.method === "DELETE") {
    const malId = Number(req.query.mal_id);
    if (!malId) {
      res.status(400).json({ error: "mal_id required" });
      return;
    }
    const r = await malFetch(token, `/anime/${malId}/my_list_status`, {
      method: "DELETE",
    });
    if (!r.ok && r.status !== 404) {
      res.status(r.status).send(await r.text());
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== "PUT" && req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const body = (req.body ?? {}) as {
    mal_id?: number;
    status?: string;
    score?: number | null;
  };
  const malId = Number(body.mal_id);
  if (!malId) {
    res.status(400).json({ error: "mal_id required" });
    return;
  }

  const form = new URLSearchParams();
  if (body.status) form.set("status", body.status);
  if (body.score !== undefined && body.score !== null) {
    form.set("score", String(body.score));
  }
  if (body.score === null) form.set("score", "0");

  const r = await malFetch(token, `/anime/${malId}/my_list_status`, {
    method: "PUT",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!r.ok) {
    res.status(r.status).send(await r.text());
    return;
  }
  const data = await r.json();
  res.status(200).json(data);
}
