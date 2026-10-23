/**
 * Small KV helpers for caches and quotas. A missing namespace or a KV error never
 * fails a cache read or write: a miss is just a miss. A quota is different: every
 * quota here guards spend on someone else's service (Windy, Nominatim, the model),
 * so one that cannot be counted refuses ('unavailable') rather than allows.
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

export type QuotaResult = 'ok' | 'over' | 'unavailable'

/**
 * Count one use of `name` by `who` in the current window: 'over' when `who` already
 * used `limit` in this window, 'unavailable' when there is no KV or it fails.
 */
export async function takeQuota(
  kv: KvLike | undefined,
  name: string,
  who: string,
  limit: number,
  windowSeconds: number,
): Promise<QuotaResult> {
  if (!kv) return 'unavailable'
  const bucket = Math.floor(Date.now() / 1000 / windowSeconds)
  const key = `quota:${name}:${who}:${bucket}`
  try {
    const used = Number.parseInt((await kv.get(key)) ?? '0', 10) || 0
    if (used >= limit) return 'over'
    await kv.put(key, String(used + 1), { expirationTtl: ttl(windowSeconds * 2) })
    return 'ok'
  } catch {
    return 'unavailable'
  }
}

/** A short, KV-safe key part for free text: hex SHA-256 of the input. */
export async function keyDigest(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  return Array.from(bytes.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')
}
