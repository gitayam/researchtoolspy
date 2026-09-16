/**
 * Clearing the browser-local work that belongs to whoever was signed in.
 *
 * GuestModeContext exposes getStorageKey/saveToLocalStorage/loadFromLocalStorage,
 * which prefix guest data with `guest_` so clearGuestStorage() can reclaim it.
 * Nothing in the application ever called them -- the sole consumer of
 * useGuestMode() is GuestModeBanner, and it reads `isGuest`. So every draft
 * below is written to an unprefixed key, transferGuestStorage() has never had
 * anything to move, and clearGuestStorage() only ever removed the three session
 * keys it created itself.
 *
 * The consequence is not a guest-mode subtlety: on a shared browser, logging out
 * left this work in place for the next person to sign in. They would open the
 * SWOT or COG form and find someone else's unsaved draft already filled in, and
 * could save it into their own workspace.
 *
 * Namespacing every call site is the larger fix. This closes the actual exposure
 * by clearing the work at the session boundary, which is also the honest
 * behaviour: these drafts are per-person, not per-device.
 *
 * Device preferences are deliberately NOT cleared -- `theme` and `app-language`
 * belong to the browser, not the account.
 */

/** Exact keys holding one signed-in person's content. */
const USER_SCOPED_KEYS = [
  'cog_analyses',                                  // pages/frameworks/index.tsx
  'citations-library',                             // utils/citation-library.ts
  'cop_quick_capture_recent',                      // components/cop/CopGlobalCapture.tsx
  'ach_hypothesis_from_claim',                     // components/content-intelligence/ClaimAnalysisDisplay.tsx
  'research_plan_from_claim',                      // components/content-intelligence/ClaimAnalysisDisplay.tsx
  'pending_url_analysis',                          // pages/LandingPage.tsx, EvidenceSubmissionsPage.tsx
  'source_content_id',                             // pages/ContentLibraryPage.tsx
  'researchtools.timeline.manual-draft.v1',        // pages/tools/TimelineAnalysisPage.tsx
] as const

/** Key prefixes covering families of per-person entries. */
const USER_SCOPED_PREFIXES = [
  'draft_',                                        // framework form drafts (Generic, Swot, PublicFramework)
  'settings_',                                     // hooks/useSettings.ts
  'cop_panel_layout_',                             // hooks/usePanelLayout.ts
  'researchtools.timeline.recovery.v1.',           // pages/tools/TimelineAnalysisPage.tsx
  'guest_',                                        // anything the guest helpers did namespace
] as const

/**
 * Remove every browser-local entry belonging to the outgoing session.
 * Safe to call when storage is unavailable (private mode, blocked site data).
 */
export function clearUserScopedStorage(): void {
  try {
    const doomed: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key) continue
      if (USER_SCOPED_KEYS.includes(key as typeof USER_SCOPED_KEYS[number])
        || USER_SCOPED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        doomed.push(key)
      }
    }
    doomed.forEach((key) => localStorage.removeItem(key))
  } catch {
    // Nothing to clear if storage cannot be read.
  }
}
