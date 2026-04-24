import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFreshAccessToken, malFetch, withErrorHandling } from "../_lib";

export default withErrorHandling(async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const token = await getFreshAccessToken(req, res);
  if (!token) {
    res.status(200).json({ authenticated: false });
    return;
  }
  const r = await malFetch(token, "/users/@me?fields=name,picture");
  if (!r.ok) {
    res.status(200).json({ authenticated: false });
    return;
  }
  const data = await r.json();
  res.status(200).json({ authenticated: true, user: data });
});
