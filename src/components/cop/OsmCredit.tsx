/**
 * OsmCredit -- the credit Nominatim's usage policy requires wherever a geocoder
 * result is shown. The server's own text and link are used when they look right.
 */

const DEFAULT_TEXT = '© OpenStreetMap contributors'
const DEFAULT_URL = 'https://www.openstreetmap.org/copyright'

function osmUrl(url: string | null | undefined): string {
  if (!url) return DEFAULT_URL
  try {
    const parsed = new URL(url)
    const host = parsed.hostname
    return parsed.protocol === 'https:' && (host === 'openstreetmap.org' || host === 'www.openstreetmap.org')
      ? parsed.href
      : DEFAULT_URL
  } catch {
    return DEFAULT_URL
  }
}

export default function OsmCredit({ text, url, className = '' }: { text?: string | null; url?: string | null; className?: string }) {
  const label = text && text.length <= 80 ? text : DEFAULT_TEXT
  return (
    <a
      href={osmUrl(url)}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      className={`text-[11px] text-gray-600 dark:text-gray-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 rounded ${className}`}
    >
      {label}
    </a>
  )
}
