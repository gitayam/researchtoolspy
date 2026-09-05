import { test, expect } from '@playwright/test'
import {
  GUEST_SESSION_EXPIRY_MS,
  GUEST_SESSION_KEY,
  GUEST_SESSION_TIMESTAMP_KEY,
  GUEST_WORKSPACE_KEY,
  getOrCreateGuestSessionId,
  getOrCreateGuestWorkspaceId,
} from '../../../src/lib/guest-session'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

test.describe('Guest session identity @smoke', () => {
  test('@smoke creates and reuses a strong guest session synchronously', () => {
    const storage = new MemoryStorage()
    const created = getOrCreateGuestSessionId(storage, 1_000)
    const reused = getOrCreateGuestSessionId(storage, 2_000)

    expect(created).toMatch(/^guest_[0-9a-f-]{36}$/)
    expect(reused).toBe(created)
    expect(storage.getItem(GUEST_SESSION_TIMESTAMP_KEY)).toBe('1000')
    const workspaceId = getOrCreateGuestWorkspaceId(storage)
    expect(workspaceId).toMatch(/^guest-workspace-[0-9a-f-]{36}$/)
    expect(getOrCreateGuestWorkspaceId(storage)).toBe(workspaceId)
  })

  test('@smoke rotates an expired session and clears guest data', () => {
    const storage = new MemoryStorage()
    storage.setItem(GUEST_SESSION_KEY, 'guest_018f47ce-f8f4-7ad5-9f6d-83e61296f891')
    storage.setItem(GUEST_SESSION_TIMESTAMP_KEY, '1000')
    storage.setItem('guest_cross_tables', '{"private":true}')
    storage.setItem(GUEST_WORKSPACE_KEY, 'guest-workspace-018f47ce-f8f4-7ad5-9f6d-83e61296f891')
    storage.setItem('unrelated', 'keep')

    const rotated = getOrCreateGuestSessionId(storage, 1_000 + GUEST_SESSION_EXPIRY_MS)

    expect(rotated).toMatch(/^guest_[0-9a-f-]{36}$/)
    expect(rotated).not.toBe('guest_018f47ce-f8f4-7ad5-9f6d-83e61296f891')
    expect(storage.getItem('guest_cross_tables')).toBeNull()
    expect(storage.getItem(GUEST_WORKSPACE_KEY)).toBeNull()
    expect(storage.getItem('unrelated')).toBe('keep')
  })
})
