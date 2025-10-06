import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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

const getNavigation = (t: (key: string) => string) => [
  { name: t('navigation.dashboard'), href: '/dashboard', icon: Home },
  {
    name: t('navigation.analysisFrameworks'),
    href: '/dashboard/analysis-frameworks',
    icon: Brain,
    children: [
      {
        name: t('frameworkCategories.environmental'),
        isCategory: true,
        children: [
          { name: t('frameworks.swot'), href: '/dashboard/analysis-frameworks/swot-dashboard' },
          { name: t('frameworks.pest'), href: '/dashboard/analysis-frameworks/pest' },
          { name: t('frameworks.pmesiipt'), href: '/dashboard/analysis-frameworks/pmesii-pt' },
          { name: t('frameworks.dime'), href: '/dashboard/analysis-frameworks/dime' },
          { name: t('frameworks.dotmlpf'), href: '/dashboard/analysis-frameworks/dotmlpf' },
        ]
      },
      {
        name: t('frameworkCategories.nodal'),
        isCategory: true,
        children: [
          { name: t('frameworks.cog'), href: '/dashboard/analysis-frameworks/cog' },
          { name: t('frameworks.causeway'), href: '/dashboard/analysis-frameworks/causeway' },
        ]
      },
      {
        name: t('frameworkCategories.hypothesis'),
        isCategory: true,
        children: [
          { name: t('frameworks.ach'), href: '/dashboard/analysis-frameworks/ach-dashboard' },
          { name: t('frameworks.deception'), href: '/dashboard/analysis-frameworks/deception' },
        ]
      },
      {
        name: t('frameworkCategories.humanFactors'),
        isCategory: true,
        children: [
          { name: t('frameworks.stakeholder'), href: '/dashboard/analysis-frameworks/stakeholder' },
          { name: t('frameworks.behavior'), href: '/dashboard/analysis-frameworks/behavior' },
          { name: t('frameworks.comb'), href: '/dashboard/analysis-frameworks/comb-analysis' },
        ]
      },
      {
        name: t('frameworkCategories.creative'),
        isCategory: true,
        children: [
          { name: t('frameworks.starbursting'), href: '/dashboard/analysis-frameworks/starbursting' },
          { name: t('frameworks.fundamentalFlow'), href: '/dashboard/analysis-frameworks/fundamental-flow' },
        ]
      },
      {
        name: t('frameworkCategories.monitoring'),
        isCategory: true,
        children: [
          { name: t('frameworks.surveillance'), href: '/dashboard/analysis-frameworks/surveillance' },
        ]
      },
    ]
  },
  {
    name: t('navigation.researchTools'),
    href: '/dashboard/tools',
    icon: Search,
    children: [
      { name: 'Content Intelligence', href: '/dashboard/tools/content-intelligence', icon: Sparkles },
      { name: t('tools.citationsGenerator'), href: '/dashboard/tools/citations-generator' },
      { name: t('tools.documents'), href: '/dashboard/tools/documents' },
    ]
  },
  {
    name: t('navigation.evidenceCollection'),
    href: '/dashboard/evidence',
    icon: Archive,
    children: [
      { name: t('navigation.data'), href: '/dashboard/evidence' },
      { name: t('navigation.actors'), href: '/dashboard/entities/actors' },
      { name: t('navigation.sources'), href: '/dashboard/entities/sources' },
      { name: t('navigation.events'), href: '/dashboard/entities/events' },
    ]
  },
  { name: t('navigation.networkAnalysis'), href: '/dashboard/network', icon: Network },
  { name: t('navigation.datasetLibrary'), href: '/dashboard/datasets', icon: Database },
  { name: t('navigation.reports'), href: '/dashboard/reports', icon: FileText },
  { name: t('navigation.collaboration'), href: '/dashboard/collaboration', icon: Users },
  {
    name: t('navigation.settings'),
    href: '/dashboard/settings',
    icon: Settings,
    children: [
      { name: t('navigation.general'), href: '/dashboard/settings' },
      { name: t('tools.aiConfiguration'), href: '/dashboard/settings/ai', icon: Sparkles },
    ]
  },
]

export function DashboardSidebar() {
  const location = useLocation()
  const pathname = location.pathname
  const { t } = useTranslation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([
    t('navigation.analysisFrameworks'),
    t('navigation.researchTools'),
    t('navigation.evidenceCollection'),
    t('frameworkCategories.environmental'),
    t('frameworkCategories.nodal'),
    t('frameworkCategories.hypothesis'),
    t('frameworkCategories.humanFactors'),
    t('frameworkCategories.creative'),
    t('frameworkCategories.monitoring')
  ])

  const navigation = getNavigation(t)

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
                      {item.children.map((child: any) => (
                        <li key={child.name}>
                          {child.isCategory ? (
                            <>
                              <button
                                onClick={() => toggleExpanded(child.name)}
                                className="w-full text-left py-1.5 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-blue-600 dark:hover:text-blue-400"
                              >
                                {child.name}
                              </button>
                              {expandedItems.includes(child.name) && (
                                <ul className="ml-2 mt-1 space-y-1">
                                  {child.children.map((subChild: any) => (
                                    <li key={subChild.name}>
                                      <Link
                                        to={subChild.href}
                                        className={cn(
                                          pathname === subChild.href
                                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                            : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-800',
                                          'block rounded-md py-1.5 px-3 text-sm leading-6'
                                        )}
                                      >
                                        {subChild.name}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </>
                          ) : (
                            <Link
                              to={child.href}
                              className={cn(
                                pathname === child.href
                                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-800',
                                'flex items-center gap-x-2 rounded-md py-1.5 px-3 text-sm leading-6'
                              )}
                            >
                              {child.icon && <child.icon className="h-4 w-4 shrink-0" />}
                              {child.name}
                            </Link>
                          )}
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