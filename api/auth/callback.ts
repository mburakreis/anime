import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  COOKIE_STATE,
  COOKIE_VERIFIER,
  MAL_TOKEN_URL,
  appendSetCookie,
  env,
  parseCookies,
  redirectUri,
  serializeCookie,
  setAuthCookies,
  withErrorHandling,
} from "../_lib.js";

export default withErrorHandling(async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { code, state, error } = req.query as Record<string, string>;
  if (error) {
    res.status(400).send(`MAL auth error: ${error}`);
    return;
  }
  if (!code || !state) {
    res.status(400).send("Missing code or state");
    return;
  }

  const cookies = parseCookies(req);
  const expectedState = cookies[COOKIE_STATE];
  const verifier = cookies[COOKIE_VERIFIER];
  if (!expectedState || expectedState !== state) {
    res.status(400).send("State mismatch");
    return;
  }
  if (!verifier) {
    res.status(400).send("Missing code verifier");
    return;
  }

  const body = new URLSearchParams({
    client_id: env("MAL_CLIENT_ID"),
    client_secret: env("MAL_CLIENT_SECRET"),
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri(req),
  });

  const tokenRes = await fetch(MAL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    res.status(tokenRes.status).send(`Token exchange failed: ${text}`);
    return;
  }

  const data = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  appendSetCookie(res, serializeCookie(COOKIE_VERIFIER, "", { maxAge: 0 }));
  appendSetCookie(res, serializeCookie(COOKIE_STATE, "", { maxAge: 0 }));
  setAuthCookies(res, data.access_token, data.refresh_token, data.expires_in);

  res.redirect(302, "/");
});
