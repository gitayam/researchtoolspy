/**
 * Ownership of the "which workspace is selected" browser keys.
 *
 * These two keys are read directly by getCopHeaders() in src/lib/cop-auth.ts to
 * build the X-Workspace-ID header, which means they -- not React state -- decide
 * what every API call is scoped to. Two bugs came out of that split:
 *
 *  1. A guest's auto-provisioned `guest-workspace-<uuid>` was reaching these keys
 *     via WorkspaceContext persisting `owned[0].id`. They carry no `guest_`
 *     prefix, so clearGuestStorage() never removed them, and after login the
 *     account sent a workspace id owned by the guest principal -- 403 on every
 *     write. writeSelectedWorkspaceId() now refuses guest ids outright: the
 *     guest header already comes from GUEST_WORKSPACE_KEY in guest-session.ts.
 *
 *  2. Logout cleared the credential keys but left these behind, so the next
 *     account to use the browser inherited the previous one's workspace id.
 *     clearSelectedWorkspaceId() exists so the auth store can drop them too.
 */

export const OMNICORE_WORKSPACE_KEY = 'omnicore_workspace_id'
export const CURRENT_WORKSPACE_KEY = 'current_workspace_id'

/** Both keys are kept in sync; older builds wrote only `current_workspace_id`. */
export const SELECTED_WORKSPACE_KEYS = [OMNICORE_WORKSPACE_KEY, CURRENT_WORKSPACE_KEY] as const

const GUEST_WORKSPACE_PATTERN = /^guest-workspace-[0-9a-f-]{36}$/

export function isGuestWorkspaceId(workspaceId: string | null | undefined): boolean {
  return !!workspaceId && GUEST_WORKSPACE_PATTERN.test(workspaceId)
}

export function readSelectedWorkspaceId(): string {
  try {
    for (const key of SELECTED_WORKSPACE_KEYS) {
      const value = localStorage.getItem(key)
      // A guest id that a pre-fix build already persisted is ignored rather than
      // returned, so an existing browser heals itself on the next load.
      if (value && !isGuestWorkspaceId(value)) return value
    }
  } catch {
    // Private mode / blocked site data.
  }
  return ''
}

/** Persist the selected workspace. Guest workspace ids are deliberately dropped. */
export function writeSelectedWorkspaceId(workspaceId: string): void {
  if (!workspaceId || isGuestWorkspaceId(workspaceId)) {
    clearSelectedWorkspaceId()
    return
  }
  try {
    for (const key of SELECTED_WORKSPACE_KEYS) localStorage.setItem(key, workspaceId)
  } catch {
    // Non-fatal: the request falls back to the workspace the server resolves.
  }
}

export function clearSelectedWorkspaceId(): void {
  try {
    for (const key of SELECTED_WORKSPACE_KEYS) localStorage.removeItem(key)
  } catch {
    // Non-fatal.
  }
}
