// Sensitive-use consent store
import { create } from 'zustand'
import { createLogger } from '@/lib/logger'
import { getCopHeaders } from '@/lib/cop-auth'

const logger = createLogger('Consent')

interface ConsentState {
  open: boolean
  consentType: string | null
  // Internal pending-promise resolver (not part of the public surface)
  _resolve: ((accepted: boolean) => void) | null
  requestConsent: (consentType: string) => Promise<boolean>
  accept: () => Promise<void>
  cancel: () => void
}

export const useConsentStore = create<ConsentState>()((set, get) => ({
  open: false,
  consentType: null,
  _resolve: null,

  requestConsent: (consentType: string) => {
    return new Promise<boolean>((resolve) => {
      // If a request is already pending, resolve the prior one as cancelled
      const prev = get()._resolve
      if (prev) prev(false)
      set({ open: true, consentType, _resolve: resolve })
    })
  },

  accept: async () => {
    const { consentType, _resolve } = get()
    try {
      const response = await fetch('/api/user/consent', {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({ consent_type: consentType }),
      })
      if (!response.ok) {
        logger.error('Failed to record consent:', response.status)
        _resolve?.(false)
      } else {
        _resolve?.(true)
      }
    } catch (err) {
      logger.error('Error recording consent:', err)
      _resolve?.(false)
    } finally {
      set({ open: false, consentType: null, _resolve: null })
    }
  },

  cancel: () => {
    const { _resolve } = get()
    _resolve?.(false)
    set({ open: false, consentType: null, _resolve: null })
  },
}))
