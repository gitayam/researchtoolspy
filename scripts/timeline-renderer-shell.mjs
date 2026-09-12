// Pure assembly, verified inside the isolated validator. No application data enters this document.
import { createHash } from 'node:crypto'
export function timelineRendererShell({ scripts, styles }) {
  if (scripts.length !== 2 || styles.length !== 3 || scripts.some(value => /<\/script/i.test(value)) || styles.some(value => /<\/style/i.test(value))) throw new Error('Unexpected renderer source boundary')
  const hashes = scripts.map(value => `'sha256-${createHash('sha256').update(value).digest('base64')}'`).join(' ')
  const policy = `default-src 'none'; script-src ${hashes}; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta http-equiv="Content-Security-Policy" content="${policy}">\n<meta name="referrer" content="no-referrer">\n<title>TimelineJS narrative presentation</title>\n${styles.map(value => `<style>${value}</style>`).join('\n')}\n</head>\n<body>\n<p id="preview-status" role="status">Open a presentation from the ResearchTools Timeline export preview. This page does not load a timeline by URL.</p>\n<div id="timeline" aria-label="TimelineJS narrative presentation"></div>\n${scripts.map(value => `<script>${value}</script>`).join('\n')}\n</body>\n</html>\n`
}
