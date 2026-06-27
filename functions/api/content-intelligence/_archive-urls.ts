/**
 * Archive-URL builder for URL analysis (pure, zero-dependency, unit-testable).
 *
 * COP-9: the previous inline version also emitted
 *   `screenshot: /api/content-intelligence/screenshot?url=...`
 * but that handler does not exist (it was a `// TODO: Implement`), so every
 * analyzed URL advertised a dead link. The screenshot key is removed here until
 * a real screenshot service exists (tracked as DECISION D-C in the roadmap).
 * Only archive destinations that actually resolve are returned.
 */
export function generateArchiveUrls(url: string): Record<string, string> {
  return {
    wayback: `https://web.archive.org/web/*/${url}`,
    archive_is: `https://archive.is/${url}`,
  }
}
