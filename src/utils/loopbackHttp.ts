// @ajan: cursor · @etiket: http, loopback, makale-yazim, bridge
/** Shared loopback-only HTTP helpers for optional local services. */

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function isLoopbackHttpUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!LOOPBACK.has(parsed.hostname.toLowerCase())) return null;
  return trimmed;
}

export async function fetchLoopbackJson(
  baseUrl: string,
  path: string,
  timeoutMs = 4000,
): Promise<{ ok: true; json: unknown } | { ok: false; error: string }> {
  const base = isLoopbackHttpUrl(baseUrl);
  if (!base) return { ok: false, error: "not-loopback" };
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { ok: false, error: `http-${res.status}` };
    const json = await res.json();
    return { ok: true, json };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

export async function postLoopbackJson(
  baseUrl: string,
  path: string,
  body: unknown,
  timeoutMs = 15000,
): Promise<{ ok: true; json: unknown } | { ok: false; error: string }> {
  const base = isLoopbackHttpUrl(baseUrl);
  if (!base) return { ok: false, error: "not-loopback" };
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, error: `http-${res.status}` };
    const json = await res.json();
    return { ok: true, json };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
