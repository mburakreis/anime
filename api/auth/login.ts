import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  COOKIE_STATE,
  COOKIE_VERIFIER,
  MAL_AUTH_URL,
  appendSetCookie,
  env,
  randomString,
  redirectUri,
  serializeCookie,
  withErrorHandling,
} from "../_lib";

export default withErrorHandling(function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const verifier = randomString(48);
  const state = randomString(16);

  appendSetCookie(
    res,
    serializeCookie(COOKIE_VERIFIER, verifier, { maxAge: 600 })
  );
  appendSetCookie(
    res,
    serializeCookie(COOKIE_STATE, state, { maxAge: 600 })
  );

  const params = new URLSearchParams({
    response_type: "code",
    client_id: env("MAL_CLIENT_ID"),
    code_challenge: verifier,
    code_challenge_method: "plain",
    state,
    redirect_uri: redirectUri(req),
  });

  res.redirect(302, `${MAL_AUTH_URL}?${params.toString()}`);
});
