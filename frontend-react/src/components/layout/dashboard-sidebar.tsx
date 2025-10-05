import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  BarChart3,
  Brain,
  FileText,
  Globe,
  Home,
  Search,
  Settings,
  Target,
  Users,
  Zap,
  Menu,
  X,
  Archive,
  Database,
  Calendar,
  Shield,
  Network,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  {
    name: 'Analysis Frameworks',
    href: '/dashboard/analysis-frameworks',
    icon: Brain,
    children: [
      { name: 'SWOT Analysis', href: '/dashboard/analysis-frameworks/swot-dashboard' },
      { name: 'COG Analysis', href: '/dashboard/analysis-frameworks/cog' },
      { name: 'PMESII-PT', href: '/dashboard/analysis-frameworks/pmesii-pt' },
      { name: 'ACH Analysis', href: '/dashboard/analysis-frameworks/ach-dashboard' },
      { name: 'DOTMLPF', href: '/dashboard/analysis-frameworks/dotmlpf' },
      { name: 'Deception Detection', href: '/dashboard/analysis-frameworks/deception' },
      { name: 'Behavioral Analysis', href: '/dashboard/analysis-frameworks/behavior' },
      { name: 'COM-B Analysis', href: '/dashboard/analysis-frameworks/comb-analysis' },
      { name: 'Starbursting', href: '/dashboard/analysis-frameworks/starbursting' },
      { name: 'Causeway', href: '/dashboard/analysis-frameworks/causeway' },
      { name: 'DIME Framework', href: '/dashboard/analysis-frameworks/dime' },
      { name: 'PEST Analysis', href: '/dashboard/analysis-frameworks/pest' },
      { name: 'Stakeholder Analysis', href: '/dashboard/analysis-frameworks/stakeholder' },
      { name: 'Surveillance Framework', href: '/dashboard/analysis-frameworks/surveillance' },
      { name: 'Fundamental Flow', href: '/dashboard/analysis-frameworks/fundamental-flow' },
    ]
  },
  {
    name: 'Research Tools',
    href: '/dashboard/tools',
    icon: Search,
    children: [
      { name: 'Content Extraction', href: '/dashboard/tools/content-extraction' },
      { name: 'Batch Processing', href: '/dashboard/tools/batch-processing' },
      { name: 'URL Processing', href: '/dashboard/tools/url' },
      { name: 'Citations Generator', href: '/dashboard/tools/citations-generator' },
      { name: 'Web Scraping', href: '/dashboard/tools/scraping' },
      { name: 'Social Media', href: '/dashboard/tools/social-media' },
      { name: 'Documents', href: '/dashboard/tools/documents' },
    ]
  },
  {
    name: 'Evidence Collection',
    href: '/dashboard/evidence',
    icon: Archive,
    children: [
      { name: 'Data', href: '/dashboard/evidence' },
      { name: 'Actors', href: '/dashboard/entities/actors' },
      { name: 'Sources', href: '/dashboard/entities/sources' },
      { name: 'Events', href: '/dashboard/entities/events' },
    ]
  },
  { name: 'Network Analysis', href: '/dashboard/network', icon: Network },
  { name: 'Dataset Library', href: '/dashboard/datasets', icon: Database },
  { name: 'Reports', href: '/dashboard/reports', icon: FileText },
  { name: 'Collaboration', href: '/dashboard/collaboration', icon: Users },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    children: [
      { name: 'General', href: '/dashboard/settings' },
      { name: 'AI Configuration', href: '/dashboard/settings/ai', icon: Sparkles },
    ]
  },
]

export function DashboardSidebar() {
  const location = useLocation()
  const pathname = location.pathname
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>(['Analysis Frameworks', 'Evidence Collection'])

  const toggleExpanded = (name: string) => {
    setExpandedItems(prev => 
      prev.includes(name) 
        ? prev.filter(item => item !== name)
        : [...prev, name]
    )
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-6">
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="Research Tools Logo"
            className="h-10 w-10 rounded-md"
          />
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            Research Tools
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col px-6 pb-4">
        <ul role="list" className="flex flex-1 flex-col gap-y-1">
          {navigation.map((item) => (
            <li key={item.name}>
              {!item.children ? (
                <Link
                  to={item.href}
                  className={cn(
                    pathname === item.href
                      ? 'bg-blue-50 border-r-2 border-blue-600 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-gray-800',
                    'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium'
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.name}
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => toggleExpanded(item.name)}
                    className={cn(
                      pathname.startsWith(item.href)
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-gray-800',
                      'group flex w-full gap-x-3 rounded-md p-2 text-sm leading-6 font-medium'
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {item.name}
                  </button>
                  {expandedItems.includes(item.name) && (
                    <ul className="mt-1 ml-6 space-y-1">
                      {item.children.map((child) => (
                        <li key={child.name}>
                          <Link
                            to={child.href}
                            className={cn(
                              pathname === child.href
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-800',
                              'block rounded-md py-1.5 px-3 text-sm leading-6'
                            )}
                          >
                            {child.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden">
        <button
          type="button"
          className="fixed top-4 left-4 z-50 rounded-md bg-white dark:bg-gray-800 p-2 text-gray-400 dark:text-gray-300 shadow-sm lg:hidden"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-gray-900/80" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 shadow-xl">
            <button
              type="button"
              className="absolute top-4 right-4 rounded-md p-2 text-gray-400 hover:text-gray-500"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700">
          <SidebarContent />
        </div>
      </div>
    </>
  )
}