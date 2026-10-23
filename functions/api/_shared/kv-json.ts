/**
 * Small KV helpers for caches and per-caller quotas. A missing namespace or a KV
 * error never fails the request: a cache miss is just a miss, and a quota that
 * cannot be counted allows the call (the upstream's own limits still apply).
 * Cloudflare KV refuses an expirationTtl below 60, so every TTL is clamped to 60.
 */

export interface KvLike {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

const ttl = (seconds: number) => Math.max(60, Math.ceil(seconds))

export async function kvGetJson<T>(kv: KvLike | undefined, key: string): Promise<T | null> {
  if (!kv) return null
  try {
    const raw = await kv.get(key)
    return raw == null ? null : (JSON.parse(raw) as T)
  } catch {
    return null
  }
}

export async function kvPutJson(kv: KvLike | undefined, key: string, value: unknown, seconds: number): Promise<void> {
  if (!kv) return
  try {
    await kv.put(key, JSON.stringify(value), { expirationTtl: ttl(seconds) })
  } catch {
    // A failed cache write only costs a later miss.
  }
}

/**
 * Count one use of `name` for `caller` in the current window. Returns false when
 * the caller already used `limit` calls in this window.
 */
export async function consumeQuota(
  kv: KvLike | undefined,
  name: string,
  caller: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  if (!kv) return true
  const bucket = Math.floor(Date.now() / 1000 / windowSeconds)
  const key = `quota:${name}:${caller}:${bucket}`
  try {
    const used = Number.parseInt((await kv.get(key)) ?? '0', 10) || 0
    if (used >= limit) return false
    await kv.put(key, String(used + 1), { expirationTtl: ttl(windowSeconds * 2) })
    return true
  } catch {
    return true
  }
}

/** A short, KV-safe key part for free text: hex SHA-256 of the input. */
export async function keyDigest(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  return Array.from(bytes.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')
}
