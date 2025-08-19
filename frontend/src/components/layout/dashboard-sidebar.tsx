'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  Archive
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { 
    name: 'Analysis Frameworks', 
    href: '/analysis-frameworks', 
    icon: Brain,
    children: [
      { name: 'SWOT Analysis', href: '/analysis-frameworks/swot-dashboard' },
      { name: 'COG Analysis', href: '/analysis-frameworks/cog' },
      { name: 'PMESII-PT', href: '/analysis-frameworks/pmesii-pt' },
      { name: 'ACH Analysis', href: '/analysis-frameworks/ach-dashboard' },
      { name: 'DOTMLPF', href: '/analysis-frameworks/dotmlpf' },
      { name: 'Deception Detection', href: '/analysis-frameworks/deception' },
      { name: 'Behavioral Analysis', href: '/analysis-frameworks/behavior' },
      { name: 'Starbursting', href: '/analysis-frameworks/starbursting' },
      { name: 'Causeway', href: '/analysis-frameworks/causeway' },
      { name: 'DIME Framework', href: '/analysis-frameworks/dime' },
      { name: 'PEST Analysis', href: '/analysis-frameworks/pest' },
      { name: 'VRIO Framework', href: '/analysis-frameworks/vrio' },
      { name: 'Stakeholder Analysis', href: '/analysis-frameworks/stakeholder' },
      { name: 'Trend Analysis', href: '/analysis-frameworks/trend' },
      { name: 'Surveillance Framework', href: '/analysis-frameworks/surveillance' },
      { name: 'Fundamental Flow', href: '/analysis-frameworks/fundamental-flow' },
    ]
  },
  { 
    name: 'Research Tools', 
    href: '/tools', 
    icon: Search,
    children: [
      { name: 'Content Extraction', href: '/tools/content-extraction' },
      { name: 'Batch Processing', href: '/tools/batch-processing' },
      { name: 'URL Processing', href: '/tools/url' },
      { name: 'Citations', href: '/tools/citations' },
      { name: 'Web Scraping', href: '/tools/scraping' },
      { name: 'Social Media', href: '/tools/social-media' },
      { name: 'Documents', href: '/tools/documents' },
    ]
  },
  { name: 'Evidence Collector', href: '/evidence', icon: Archive },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Collaboration', href: '/collaboration', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>(['Analysis Frameworks'])

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
          <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            OmniCore
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
                  href={item.href}
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
                            href={child.href}
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
          className="fixed top-4 left-4 z-50 rounded-md bg-white p-2 text-gray-400 shadow-sm lg:hidden"
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