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

const GROUPS: DiscoveryGroup[] = ['Tools', 'Frameworks', 'Navigate']
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
  const navigate = useNavigate()

  // Ranked, flat, best first while searching. The palette used to render its
  // groups in a fixed order — Tools, Frameworks, Navigate — so the best match
  // in the product's own subject matter sat below whatever weakly matched in
  // Tools. Grouping is for browsing; when someone has typed, the ordering that
  // matters is relevance.
  const ranked = query.trim() ? rankEntries(DISCOVERY_ENTRIES, query) : null

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
        {ranked?.length === 0 && <EmptyState search={query} />}
        {ranked && ranked.length > 0 && (
          <CommandGroup heading="Results">{ranked.map(renderItem)}</CommandGroup>
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
        <ResultCount count={ranked ? ranked.length : DISCOVERY_ENTRIES.length} />
      </CommandFooter>
    </CommandDialog>
  )
}
