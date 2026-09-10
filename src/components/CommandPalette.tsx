import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator
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
      <CommandList className="max-h-[400px]">
        <CommandEmpty>No results found.</CommandEmpty>
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
                      <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block">{cmd.label}</span>
                        <span className="block truncate text-xs font-normal text-muted-foreground">{cmd.description}</span>
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </span>
          )
        })}
      </CommandList>
    </CommandDialog>
  )
}
