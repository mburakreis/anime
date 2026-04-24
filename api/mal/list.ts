import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFreshAccessToken, malFetch, withErrorHandling } from "../_lib";

export default withErrorHandling(async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const token = await getFreshAccessToken(req, res);
  if (!token) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  const items: Array<{
    mal_id: number;
    status: string;
    score: number;
    updated_at: string;
  }> = [];

  let url =
    "/users/@me/animelist?fields=list_status&limit=1000&nsfw=true";

  while (url) {
    const r = await malFetch(token, url);
    if (!r.ok) {
      const text = await r.text();
      res.status(r.status).send(text);
      return;
    }
    const body = (await r.json()) as {
      data: Array<{
        node: { id: number };
        list_status: {
          status: string;
          score: number;
          updated_at: string;
        };
      }>;
      paging?: { next?: string };
    };
    for (const row of body.data) {
      items.push({
        mal_id: row.node.id,
        status: row.list_status.status,
        score: row.list_status.score,
        updated_at: row.list_status.updated_at,
      });
    }
    if (!body.paging?.next) break;
    url = body.paging.next.replace("https://api.myanimelist.net/v2", "");
  }

  res.setHeader("Cache-Control", "private, max-age=30");
  res.status(200).json({ items });
});
