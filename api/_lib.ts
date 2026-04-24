import type { VercelRequest, VercelResponse } from "@vercel/node";

export const MAL_AUTH_URL = "https://myanimelist.net/v1/oauth2/authorize";
export const MAL_TOKEN_URL = "https://myanimelist.net/v1/oauth2/token";
export const MAL_API_BASE = "https://api.myanimelist.net/v2";

export const COOKIE_ACCESS = "mal_at";
export const COOKIE_REFRESH = "mal_rt";
export const COOKIE_VERIFIER = "mal_cv";
export const COOKIE_STATE = "mal_st";

export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export function getOrigin(req: VercelRequest): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const host = req.headers.host ?? "localhost:3000";
  return `${proto}://${host}`;
}

export function redirectUri(req: VercelRequest): string {
  const override = process.env.MAL_REDIRECT_URI;
  if (override) return override;
  return `${getOrigin(req)}/api/auth/callback`;
}

export function parseCookies(req: VercelRequest): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(
    header.split(/; */).map((p) => {
      const i = p.indexOf("=");
      if (i < 0) return [p, ""];
      return [
        decodeURIComponent(p.slice(0, i).trim()),
        decodeURIComponent(p.slice(i + 1).trim()),
      ];
    })
  );
}

export type CookieOptions = {
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
};

export function serializeCookie(
  name: string,
  value: string,
  opts: CookieOptions = {}
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
  parts.push(`Path=${opts.path ?? "/"}`);
  if (opts.httpOnly ?? true) parts.push("HttpOnly");
  if (opts.secure ?? true) parts.push("Secure");
  parts.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  return parts.join("; ");
}

export function appendSetCookie(res: VercelResponse, cookie: string) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookie);
    return;
  }
  const arr = Array.isArray(existing) ? existing : [String(existing)];
  res.setHeader("Set-Cookie", [...arr, cookie]);
}

export function randomString(bytes = 48): string {
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const body = new URLSearchParams({
    client_id: env("MAL_CLIENT_ID"),
    client_secret: env("MAL_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const r = await fetch(MAL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) return null;
  return (await r.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

export function setAuthCookies(
  res: VercelResponse,
  accessToken: string,
  refreshToken: string,
  accessExpiresIn: number
) {
  appendSetCookie(
    res,
    serializeCookie(COOKIE_ACCESS, accessToken, {
      maxAge: Math.max(60, accessExpiresIn - 60),
    })
  );
  appendSetCookie(
    res,
    serializeCookie(COOKIE_REFRESH, refreshToken, {
      maxAge: 60 * 60 * 24 * 180,
    })
  );
}

export function clearAuthCookies(res: VercelResponse) {
  appendSetCookie(res, serializeCookie(COOKIE_ACCESS, "", { maxAge: 0 }));
  appendSetCookie(res, serializeCookie(COOKIE_REFRESH, "", { maxAge: 0 }));
}

export async function malFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(`${MAL_API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getFreshAccessToken(
  req: VercelRequest,
  res: VercelResponse
): Promise<string | null> {
  const cookies = parseCookies(req);
  if (cookies[COOKIE_ACCESS]) return cookies[COOKIE_ACCESS];
  const rt = cookies[COOKIE_REFRESH];
  if (!rt) return null;
  const refreshed = await refreshAccessToken(rt);
  if (!refreshed) {
    clearAuthCookies(res);
    return null;
  }
  setAuthCookies(
    res,
    refreshed.access_token,
    refreshed.refresh_token,
    refreshed.expires_in
  );
  return refreshed.access_token;
}
