import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CommandDialog, CommandInput, CommandList,
  CommandGroup, CommandItem, CommandSeparator, CommandFooter, CommandKey
} from '@/components/ui/command'
import {
  Home, Search, Folder, Brain, Archive, Network, Database,
  FileText, Settings, BarChart, Zap, Globe, Code, Share2,
  FileStack, Mail, Sparkles, TableProperties, Users, Lightbulb,
  Map, Activity, BookOpen, Shield, Calendar
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  DISCOVERY_ENTRIES,
  type DiscoveryEntry,
  type DiscoveryGroup,
  type DiscoveryIcon,
} from '@/config/discovery-catalog'
import { rankEntries } from '@/lib/discovery-rank'
import { getCopHeaders } from '@/lib/cop-auth'

const GROUPS: DiscoveryGroup[] = ['Tools', 'Frameworks', 'Navigate']

/** A thing the caller made, as returned by /api/discovery/search. */
interface ContentHit {
  kind: 'framework' | 'cop' | 'actor' | 'investigation' | 'cross-table'
  id: string
  title: string
  detail: string | null
  href: string
}

const CONTENT_ICONS: Record<ContentHit['kind'], LucideIcon> = {
  framework: Brain,
  cop: Map,
  actor: Users,
  investigation: Search,
  'cross-table': TableProperties,
}

const CONTENT_LABELS: Record<ContentHit['kind'], string> = {
  framework: 'Analysis',
  cop: 'COP session',
  actor: 'Actor',
  investigation: 'Investigation',
  'cross-table': 'Cross table',
}
const ICONS: Record<DiscoveryIcon, LucideIcon> = {
  activity: Activity,
  archive: Archive,
  'bar-chart': BarChart,
  book: BookOpen,
  brain: Brain,
  calendar: Calendar,
  code: Code,
  database: Database,
  'file-stack': FileStack,
  'file-text': FileText,
  folder: Folder,
  globe: Globe,
  home: Home,
  lightbulb: Lightbulb,
  mail: Mail,
  map: Map,
  network: Network,
  search: Search,
  settings: Settings,
  share: Share2,
  shield: Shield,
  sparkles: Sparkles,
  table: TableProperties,
  users: Users,
  zap: Zap,
}

/**
 * Counts the rows this component rendered.
 *
 * It used to read cmdk's `filtered.count`, which was correct while cmdk owned
 * the filtering. It no longer does — `shouldFilter` is false and the ranking is
 * ours — so that count would report the whole catalogue regardless of the query.
 */
function ResultCount({ count }: { count: number }) {
  return <span aria-live="polite">{count} {count === 1 ? 'result' : 'results'}</span>
}

/** Names what was searched for, so a dead end is diagnosable rather than blank. */
function EmptyState({ search }: { search: string }) {
  return (
    <div className="py-6 text-center text-sm">
      <p className="font-medium text-foreground">
        {search ? <>No matches for &ldquo;{search}&rdquo;</> : 'No results'}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-muted-foreground">
        Try a tool name like &ldquo;timeline&rdquo;, a framework like &ldquo;ACH&rdquo;, or a page like &ldquo;settings&rdquo;.
      </p>
    </div>
  )
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  // Kept with the query it answers, so a slow response for an older query cannot be shown
  // beside a newer one — and so the effect never has to clear state synchronously.
  const [content, setContent] = useState<{ query: string; hits: ContentHit[] }>({ query: '', hits: [] })
  const navigate = useNavigate()

  // Ranked, flat, best first while searching. The palette used to render its
  // groups in a fixed order — Tools, Frameworks, Navigate — so the best match
  // in the product's own subject matter sat below whatever weakly matched in
  // Tools. Grouping is for browsing; when someone has typed, the ordering that
  // matters is relevance.
  const ranked = query.trim() ? rankEntries(DISCOVERY_ENTRIES, query) : null

  // The caller's own analyses, sessions and entities — the half of the search the static
  // catalogue cannot answer. Debounced because the palette asks on every keystroke, and
  // silent on failure: a signed-out or offline caller still gets the catalogue, which is the
  // majority of what the palette is for.
  useEffect(() => {
    const trimmed = query.trim()
    if (!open || trimmed.length < 2) return

    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/discovery/search?q=${encodeURIComponent(trimmed)}`, {
        headers: getCopHeaders(),
        signal: controller.signal,
      })
        .then(response => (response.ok ? response.json() : null))
        .then((data: { results?: ContentHit[] } | null) => {
          if (data) setContent({ query: trimmed, hits: data.results ?? [] })
        })
        .catch(() => { /* aborted, offline, or signed out: the catalogue still works */ })
    }, 150)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, open])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = useCallback((href: string) => {
    setOpen(false)
    setQuery('')
    navigate(href)
  }, [navigate])

  const renderItem = (cmd: DiscoveryEntry) => {
    const Icon = ICONS[cmd.icon]
    return (
      <CommandItem
        key={cmd.href}
        value={cmd.href}
        onSelect={() => runCommand(cmd.href)}
      >
        <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{cmd.label}</span>
          {/* Wraps to a second line instead of cutting a word in half -- these
              descriptions are how someone tells two similar tools apart. */}
          <span className="mt-0.5 line-clamp-2 block text-xs font-normal leading-snug text-muted-foreground">
            {cmd.description}
          </span>
        </span>
      </CommandItem>
    )
  }

  const renderContentItem = (hit: ContentHit) => {
    const Icon = CONTENT_ICONS[hit.kind]
    return (
      <CommandItem key={`${hit.kind}:${hit.id}`} value={`${hit.kind}:${hit.id}`} onSelect={() => runCommand(hit.href)}>
        <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{hit.title}</span>
          <span className="mt-0.5 line-clamp-2 block text-xs font-normal leading-snug text-muted-foreground">
            {CONTENT_LABELS[hit.kind]}{hit.detail ? ` · ${hit.detail}` : ''}
          </span>
        </span>
      </CommandItem>
    )
  }

  // Only for the query on screen. A response that arrives for an older query is discarded
  // rather than shown beside results it does not belong to.
  const contentHits = content.query === query.trim() ? content.hits : []

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      {/* shouldFilter=false: ranking is ours now. cmdk's own filter scores a
          fuzzy subsequence over every field, which is how "ach" reached
          "Create, m(a)nage, and export resear(ch) citations". */}
      <CommandInput
        placeholder="Search frameworks, tools, features, and pages..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[60vh]">
        {ranked?.length === 0 && contentHits.length === 0 && <EmptyState search={query} />}
        {ranked && ranked.length > 0 && (
          <CommandGroup heading="Results">{ranked.map(renderItem)}</CommandGroup>
        )}
        {/* Below the catalogue on purpose. Someone typing "ach" wants the framework, not an
            analysis that happens to mention it; the tool is the thing they cannot reach any
            other way, whereas their own work is also listed on its own page. */}
        {contentHits.length > 0 && (
          <>
            {ranked && ranked.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Your content">{contentHits.map(renderContentItem)}</CommandGroup>
          </>
        )}
        {!ranked && GROUPS.map((group, i) => {
          const items = DISCOVERY_ENTRIES.filter(entry => entry.group === group)
          return (
            <span key={group}>
              {i > 0 && <CommandSeparator />}
              <CommandGroup heading={group}>
                {items.map(renderItem)}
              </CommandGroup>
            </span>
          )
        })}
      </CommandList>
      <CommandFooter>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <CommandKey>&uarr;</CommandKey>
            <CommandKey>&darr;</CommandKey>
            <span className="ml-0.5">navigate</span>
          </span>
          <span className="flex items-center gap-1">
            <CommandKey>&crarr;</CommandKey>
            <span className="ml-0.5">open</span>
          </span>
          <span className="hidden items-center gap-1 sm:flex">
            <CommandKey className="px-1.5">esc</CommandKey>
            <span className="ml-0.5">close</span>
          </span>
        </span>
        <ResultCount count={ranked ? ranked.length + contentHits.length : DISCOVERY_ENTRIES.length} />
      </CommandFooter>
    </CommandDialog>
  )
}
