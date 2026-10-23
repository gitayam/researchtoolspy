/**
 * A blob URL for one COP upload, fetched with the COP credentials and revoked when
 * the component goes away or the path changes.
 */
import { useEffect, useState } from 'react'
import { fetchUploadBlob } from '@/lib/cop-upload-preview'

export type UploadBlobState =
  | { status: 'loading' }
  | { status: 'ready'; url: string; type: string }
  | { status: 'error'; message: string }

const LOADING: UploadBlobState = { status: 'loading' }

export function useCopUploadBlob(path: string | null): UploadBlobState | null {
  // Keyed by path, so a new path reads as loading without setting state in the effect.
  const [loaded, setLoaded] = useState<{ path: string; state: UploadBlobState } | null>(null)

  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    let objectUrl: string | null = null
    fetchUploadBlob(path, controller.signal)
      .then(blob => {
        objectUrl = URL.createObjectURL(blob)
        setLoaded({ path, state: { status: 'ready', url: objectUrl, type: blob.type } })
      })
      .catch((error: Error) => {
        if (error?.name === 'AbortError') return
        setLoaded({ path, state: { status: 'error', message: error?.message ?? 'The file could not be loaded.' } })
      })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [path])

  if (!path) return null
  return loaded?.path === path ? loaded.state : LOADING
}
