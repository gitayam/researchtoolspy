import { useConsentStore } from '@/stores/consent'

/**
 * Wraps fetch to transparently handle the "sensitive-use consent" flow.
 *
 * If a gated endpoint returns HTTP 403 with
 * `{ code: 'consent_required', consent_type: '...' }`, this prompts the user
 * via the consent dialog. If the user acknowledges, the original request is
 * retried exactly once. Otherwise the original 403 response is returned.
 *
 * Any non-consent response is returned unchanged. Never throws beyond what
 * fetch itself throws.
 */
export async function fetchWithConsent(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init)

  if (response.status !== 403) return response

  let data: any
  try {
    data = await response.clone().json()
  } catch {
    // Not JSON — return the original 403 unchanged
    return response
  }

  if (data?.code !== 'consent_required') return response

  const accepted = await useConsentStore.getState().requestConsent(data.consent_type)
  if (!accepted) return response

  return fetch(input, init)
}
