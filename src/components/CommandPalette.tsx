import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCommandState } from 'cmdk'
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
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
  type DiscoveryGroup,
  type DiscoveryIcon,
} from '@/config/discovery-catalog'

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
 * Reads cmdk's own filtered count rather than re-running the filter here, so the
 * number shown can never disagree with the rows on screen.
 */
function ResultCount() {
  const count = useCommandState((state) => state.filtered.count)
  return <span aria-live="polite">{count} {count === 1 ? 'result' : 'results'}</span>
}

/** Names what was searched for, so a dead end is diagnosable rather than blank. */
function EmptyState() {
  const search = useCommandState((state) => state.search)
  return (
    <CommandEmpty>
      <p className="font-medium text-foreground">
        {search ? <>No matches for &ldquo;{search}&rdquo;</> : 'No results'}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-muted-foreground">
        Try a tool name like &ldquo;timeline&rdquo;, a framework like &ldquo;ACH&rdquo;, or a page like &ldquo;settings&rdquo;.
      </p>
    </CommandEmpty>
  )
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

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
    navigate(href)
  }, [navigate])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search tools, frameworks, features, and pages..." />
      <CommandList className="max-h-[60vh]">
        <EmptyState />
        {GROUPS.map((group, i) => {
          const items = DISCOVERY_ENTRIES.filter(entry => entry.group === group)
          return (
            <span key={group}>
              {i > 0 && <CommandSeparator />}
              <CommandGroup heading={group}>
                {items.map(cmd => {
                  const Icon = ICONS[cmd.icon]
                  return (
                    <CommandItem
                      key={cmd.href}
                      value={cmd.label}
                      keywords={[cmd.group, cmd.description, ...cmd.keywords]}
                      onSelect={() => runCommand(cmd.href)}
                    >
                      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{cmd.label}</span>
                        {/* Wraps to a second line instead of cutting a word in
                            half -- these descriptions are how someone tells two
                            similar tools apart. */}
                        <span className="mt-0.5 line-clamp-2 block text-xs font-normal leading-snug text-muted-foreground">
                          {cmd.description}
                        </span>
                      </span>
                    </CommandItem>
                  )
                })}
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
        <ResultCount />
      </CommandFooter>
    </CommandDialog>
  )
}
