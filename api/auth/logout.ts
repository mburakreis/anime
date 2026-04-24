import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clearAuthCookies } from "../_lib";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  clearAuthCookies(res);
  res.redirect(302, "/");
}
