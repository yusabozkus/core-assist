import "server-only"

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

// Only transport is shared. Callers own authentication, empty states and HTTP
// error handling. Cookies are passed per request and are never cached here.
export function fetchServerApi(
  path: string,
  { cookie, timeoutMs = 10_000 }: { cookie: string | null; timeoutMs?: number }
): Promise<Response> {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Server API requests require a relative API path.")
  }
  return fetch(`${apiUrl}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json", ...(cookie ? { cookie } : {}) },
    signal: AbortSignal.timeout(timeoutMs),
  })
}
