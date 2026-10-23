import { useMediaQuery } from '@/hooks/useMediaQuery'

/** Phones: below Tailwind's `md` breakpoint (768 px). */
export const PHONE_QUERY = '(max-width: 767.98px)'

export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY)
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
