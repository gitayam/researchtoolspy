import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { globSync } from 'node:fs'

/**
 * `window.confirm` cannot tell Cancel from Escape from a click outside, is drawn
 * outside the page so it can neither name what is being deleted nor follow the
 * app's theme, and blocks the document while it is open. These assertions keep
 * the replacement in place rather than letting call sites drift back.
 */
const root = process.cwd()
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

test.describe('confirmation dialog @smoke', () => {
  test('the shared confirm is mounted on both app branches', () => {
    const app = read('src/App.tsx')
    // The workspace tree and the public presentation tree are separate returns;
    // useConfirm() throws without a provider, so a page that misses one would
    // crash rather than degrade.
    expect(app.match(/<ConfirmProvider>/g)?.length).toBe(2)
    expect(app).toContain("import { ConfirmProvider } from '@/components/ui/confirm-dialog'")
  })

  test('cancel, escape and outside-click all resolve false', () => {
    const source = read('src/components/ui/confirm-dialog.tsx')
    // onOpenChange covers Escape and outside clicks; the explicit Cancel handler
    // covers the button. Both must settle, or the caller awaits forever.
    expect(source).toContain('onOpenChange={(open) => { if (!open) settle(false) }}')
    expect(source).toContain('<AlertDialogCancel onClick={() => settle(false)}>')
  })

  test('a second request does not strand the first caller', () => {
    const source = read('src/components/ui/confirm-dialog.tsx')
    expect(source).toContain('resolveRef.current?.(false)')
  })

  test('no call site has drifted back to window.confirm', () => {
    // Beyond the interaction being worse, a component holding `const confirm =
    // useConfirm()` SHADOWS window.confirm — so a stray `confirm(x)` there
    // returns a Promise, which is always truthy, and an `if (!confirm(...))`
    // guard silently stops firing in front of a destructive action. The types
    // catch that today; this keeps catching it if a call site is added without
    // the hook.
    const sources = globSync('src/**/*.{ts,tsx}', { cwd: process.cwd() })
      .filter(f => !f.endsWith('components/ui/confirm-dialog.tsx'))

    const offenders: string[] = []
    for (const file of sources) {
      const text = readFileSync(resolve(root, file), 'utf8')
      for (const [i, line] of text.split('\n').entries()) {
        if (/^\s*(\/?\*|\/\/)/.test(line)) continue
        if (/(^|[^.\w])confirm\s*\(/.test(line) && !line.includes('await confirm({')) {
          offenders.push(`${file}:${i + 1}`)
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
