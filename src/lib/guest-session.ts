export const GUEST_SESSION_KEY = 'guest_session_id'
export const GUEST_SESSION_TIMESTAMP_KEY = `${GUEST_SESSION_KEY}_timestamp`
export const GUEST_WORKSPACE_KEY = 'guest_workspace_id'
export const GUEST_DATA_PREFIX = 'guest_'
export const GUEST_SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

function browserStorage(): BrowserStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function clearGuestStorage(storage: BrowserStorage | null = browserStorage()): void {
  if (!storage) return
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith(GUEST_DATA_PREFIX)) keys.push(key)
  }
  keys.forEach((key) => storage.removeItem(key))
}

export function getActiveGuestSessionId(
  storage: BrowserStorage | null = browserStorage(),
  now = Date.now(),
): string | null {
  if (!storage) return null
  const sessionId = storage.getItem(GUEST_SESSION_KEY)
  const timestamp = Number(storage.getItem(GUEST_SESSION_TIMESTAMP_KEY))
  if (!sessionId || !Number.isFinite(timestamp) || now - timestamp >= GUEST_SESSION_EXPIRY_MS) return null
  return sessionId
}

/** Move guest-only browser drafts into their authenticated keys after the server transfer. */
export function transferGuestStorage(storage: BrowserStorage | null = browserStorage()): void {
  if (!storage) return
  const reserved = new Set([GUEST_SESSION_KEY, GUEST_SESSION_TIMESTAMP_KEY, GUEST_WORKSPACE_KEY])
  const moves: Array<{ from: string; to: string; value: string }> = []
  for (let index = 0; index < storage.length; index += 1) {
    const from = storage.key(index)
    if (!from?.startsWith(GUEST_DATA_PREFIX) || reserved.has(from)) continue
    const value = storage.getItem(from)
    if (value !== null) moves.push({ from, to: from.slice(GUEST_DATA_PREFIX.length), value })
  }
  for (const move of moves) {
    if (storage.getItem(move.to) === null) storage.setItem(move.to, move.value)
    storage.removeItem(move.from)
  }
}

export function getOrCreateGuestSessionId(
  storage: BrowserStorage | null = browserStorage(),
  now = Date.now(),
): string | null {
  if (!storage) return null

  let sessionId = storage.getItem(GUEST_SESSION_KEY)
  const timestamp = Number(storage.getItem(GUEST_SESSION_TIMESTAMP_KEY))
  const expired = !Number.isFinite(timestamp)
    || timestamp <= 0
    || now - timestamp >= GUEST_SESSION_EXPIRY_MS

  if (sessionId && expired) {
    clearGuestStorage(storage)
    sessionId = null
  }

  if (!sessionId) {
    sessionId = `guest_${crypto.randomUUID()}`
    storage.setItem(GUEST_SESSION_KEY, sessionId)
    storage.setItem(GUEST_SESSION_TIMESTAMP_KEY, String(now))
  } else if (!storage.getItem(GUEST_SESSION_TIMESTAMP_KEY)) {
    storage.setItem(GUEST_SESSION_TIMESTAMP_KEY, String(now))
  }

  return sessionId
}

export function getOrCreateGuestWorkspaceId(
  storage: BrowserStorage | null = browserStorage(),
): string | null {
  if (!storage) return null
  const existing = storage.getItem(GUEST_WORKSPACE_KEY)
  if (existing && /^guest-workspace-[0-9a-f-]{36}$/.test(existing)) return existing

  const workspaceId = `guest-workspace-${crypto.randomUUID()}`
  storage.setItem(GUEST_WORKSPACE_KEY, workspaceId)
  return workspaceId
}
