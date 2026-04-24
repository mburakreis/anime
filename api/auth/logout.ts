import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clearAuthCookies, withErrorHandling } from "../_lib";

export default withErrorHandling(function handler(
  _req: VercelRequest,
  res: VercelResponse
) {
  clearAuthCookies(res);
  res.redirect(302, "/");
});
