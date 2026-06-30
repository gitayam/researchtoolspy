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
  Map, Activity, BookOpen, Shield
} from 'lucide-react'

const COMMANDS = [
  // --- Tools ---
  { group: 'Tools', label: 'Research Question Generator', href: '/dashboard/tools/research-question-generator', icon: Sparkles },
  { group: 'Tools', label: 'Content Research', href: '/dashboard/tools/content-intelligence', icon: Search },
  { group: 'Tools', label: 'Email Header Analyzer', href: '/dashboard/tools/email-header-analyzer', icon: Mail },
  { group: 'Tools', label: 'Behavior Analysis', href: '/dashboard/tools/behavior-analysis', icon: Brain },
  { group: 'Tools', label: 'Cross Table', href: '/dashboard/tools/cross-table', icon: TableProperties },
  { group: 'Tools', label: 'Content Extraction', href: '/dashboard/tools/content-extraction', icon: FileText },
  { group: 'Tools', label: 'Batch Processing', href: '/dashboard/tools/batch-processing', icon: FileStack },
  { group: 'Tools', label: 'URL Processing', href: '/dashboard/tools/url', icon: Globe },
  { group: 'Tools', label: 'Web Scraping', href: '/dashboard/tools/scraping', icon: Code },
  { group: 'Tools', label: 'Social Media', href: '/dashboard/tools/social-media', icon: Share2 },
  { group: 'Tools', label: 'Citations Generator', href: '/dashboard/tools/citations-generator', icon: BookOpen },
  { group: 'Tools', label: 'Documents', href: '/dashboard/tools/documents', icon: FileText },
  { group: 'Tools', label: 'Equilibrium Analysis', href: '/dashboard/tools/equilibrium-analysis', icon: BarChart },
  { group: 'Tools', label: 'Hamilton Rule', href: '/dashboard/tools/hamilton-rule', icon: Users },
  { group: 'Tools', label: 'Agentic Research', href: '/dashboard/tools/collection', icon: Zap },
  // --- Navigate ---
  { group: 'Navigate', label: 'Dashboard', href: '/dashboard', icon: Home },
  { group: 'Navigate', label: 'Investigations', href: '/dashboard/investigations', icon: Folder },
  { group: 'Navigate', label: 'Intelligence', href: '/dashboard/intelligence', icon: Lightbulb },
  { group: 'Navigate', label: 'Workspaces (COP)', href: '/dashboard/cop', icon: Map },
  { group: 'Navigate', label: 'Evidence', href: '/dashboard/evidence', icon: Archive },
  { group: 'Navigate', label: 'Evidence Submissions', href: '/dashboard/research/submissions', icon: Archive },
  { group: 'Navigate', label: 'Claims', href: '/dashboard/entities/claims', icon: Shield },
  { group: 'Navigate', label: 'Actors', href: '/dashboard/entities/actors', icon: Users },
  { group: 'Navigate', label: 'Sources', href: '/dashboard/entities/sources', icon: BookOpen },
  { group: 'Navigate', label: 'Events', href: '/dashboard/entities/events', icon: Activity },
  { group: 'Navigate', label: 'Network Analysis', href: '/dashboard/network', icon: Network },
  { group: 'Navigate', label: 'Dataset Library', href: '/dashboard/datasets', icon: Database },
  { group: 'Navigate', label: 'Reports', href: '/dashboard/reports', icon: FileText },
  { group: 'Navigate', label: 'Activity', href: '/dashboard/activity', icon: Activity },
  { group: 'Navigate', label: 'Settings', href: '/dashboard/settings', icon: Settings },
  // --- Frameworks ---
  { group: 'Frameworks', label: 'ACH Analysis', href: '/dashboard/analysis-frameworks/ach-dashboard', icon: Brain },
  { group: 'Frameworks', label: 'SWOT Analysis', href: '/dashboard/analysis-frameworks/swot-dashboard', icon: Brain },
  { group: 'Frameworks', label: 'PEST Analysis', href: '/dashboard/analysis-frameworks/pest', icon: Brain },
  { group: 'Frameworks', label: 'PMESII-PT', href: '/dashboard/analysis-frameworks/pmesii-pt', icon: Brain },
  { group: 'Frameworks', label: 'DIME Framework', href: '/dashboard/analysis-frameworks/dime', icon: Brain },
  { group: 'Frameworks', label: 'DOTMLPF', href: '/dashboard/analysis-frameworks/dotmlpf', icon: Brain },
  { group: 'Frameworks', label: 'COG Analysis', href: '/dashboard/analysis-frameworks/cog', icon: Brain },
  { group: 'Frameworks', label: 'Causeway', href: '/dashboard/analysis-frameworks/causeway', icon: Brain },
  { group: 'Frameworks', label: 'Deception Analysis', href: '/dashboard/analysis-frameworks/deception', icon: Brain },
  { group: 'Frameworks', label: 'Deception Risk Dashboard', href: '/dashboard/deception-risk', icon: Shield },
  { group: 'Frameworks', label: 'Stakeholder Analysis', href: '/dashboard/analysis-frameworks/stakeholder', icon: Users },
  { group: 'Frameworks', label: 'Behavior Change (COM-B)', href: '/dashboard/analysis-frameworks/comb-analysis', icon: Brain },
  { group: 'Frameworks', label: 'Starbursting', href: '/dashboard/analysis-frameworks/starbursting', icon: Sparkles },
  { group: 'Frameworks', label: 'Fundamental Flow', href: '/dashboard/analysis-frameworks/fundamental-flow', icon: Brain },
  { group: 'Frameworks', label: 'Surveillance Framework', href: '/dashboard/analysis-frameworks/surveillance', icon: Brain },
] as const

type Group = 'Tools' | 'Navigate' | 'Frameworks'
const groups: Group[] = ['Tools', 'Navigate', 'Frameworks']

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
      <CommandInput placeholder="Search tools, pages, frameworks..." />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>No results found.</CommandEmpty>
        {groups.map((group, i) => {
          const items = COMMANDS.filter(c => c.group === group)
          return (
            <span key={group}>
              {i > 0 && <CommandSeparator />}
              <CommandGroup heading={group}>
                {items.map(cmd => {
                  const Icon = cmd.icon
                  return (
                    <CommandItem
                      key={cmd.href}
                      value={`${cmd.label} ${cmd.group}`}
                      onSelect={() => runCommand(cmd.href)}
                    >
                      <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{cmd.label}</span>
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
