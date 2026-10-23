/**
 * Files added to a COP (photos and PDFs from the capture bar, the Signal room or
 * the evidence form) live behind `GET /api/cop/:id/uploads/:uploadId`, which takes
 * the COP's header credentials only: a plain `<img src>` would get 401. These
 * components fetch the bytes with the credentials and show them from a blob URL,
 * revoked when they go away. The server has already stripped location data and
 * serves the file inert.
 */
import { useState } from 'react'
import { Download, FileText, ImageOff, Loader2 } from 'lucide-react'
import { useCopUploadBlob } from '@/hooks/useCopUploadBlob'
import { fetchUploadBlob, safeDownloadName } from '@/lib/cop-upload-preview'
import { cn } from '@/lib/utils'

/** An uploaded photo, drawn from a blob URL. */
export function CopUploadImage({ path, alt, className, onClick }: {
  path: string
  alt: string
  className?: string
  onClick?: () => void
}) {
  const blob = useCopUploadBlob(path)
  if (!blob || blob.status === 'loading') {
    return (
      <div className={cn('flex items-center justify-center bg-gray-100 dark:bg-gray-800', className)} role="status" aria-label="Loading photo">
        <Loader2 className="h-4 w-4 animate-spin text-gray-500" aria-hidden="true" />
      </div>
    )
  }
  if (blob.status === 'error' || !blob.type.startsWith('image/')) {
    return (
      <div className={cn('flex items-center justify-center bg-gray-100 dark:bg-gray-800', className)} title={blob.status === 'error' ? blob.message : 'Not an image'}>
        <ImageOff className="h-4 w-4 text-gray-500" aria-hidden="true" />
        <span className="sr-only">{blob.status === 'error' ? blob.message : 'Not an image'}</span>
      </div>
    )
  }
  const img = <img src={blob.url} alt={alt} className={cn('object-cover', className)} />
  if (!onClick) return img
  return (
    <button type="button" onClick={onClick} className="block rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500" aria-label={`Open ${alt}`}>
      {img}
    </button>
  )
}

/** A download button for an uploaded document (PDF). Fetched only when pressed. */
export function CopUploadDownload({ path, filename, className }: { path: string; filename: string; className?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const download = async () => {
    setBusy(true)
    setError(null)
    try {
      const blob = await fetchUploadBlob(path)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = safeDownloadName(filename)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (e) {
      setError((e as Error)?.message ?? 'The file could not be downloaded.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className={cn('inline-flex flex-col', className)}>
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="inline-flex min-h-[44px] sm:min-h-[32px] items-center gap-1.5 rounded border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <FileText className="h-3.5 w-3.5" aria-hidden="true" />}
        Download document
        <Download className="h-3 w-3 opacity-70" aria-hidden="true" />
      </button>
      {error && <span className="mt-0.5 text-[11px] text-red-600 dark:text-red-400" role="alert">{error}</span>}
    </span>
  )
}
