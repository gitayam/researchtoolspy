import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { DashboardLayout } from '@/layouts/DashboardLayout'

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400">Loading...</p>
    </div>
  </div>
)

// Lazy load all pages for better code splitting
// Core pages (keep these loaded for initial nav)
const LandingPage = lazy(() => import('@/pages/LandingPage').then(m => ({ default: m.LandingPage })))
const LoginPage = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/pages/RegisterPage').then(m => ({ default: m.RegisterPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })))

// Framework pages (lazy loaded)
const SwotPage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.SwotPage })))
const CogPage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.CogPage })))
const PmesiiPtPage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.PmesiiPtPage })))
const DotmlpfPage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.DotmlpfPage })))
const DeceptionPage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.DeceptionPage })))
const BehaviorPage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.BehaviorPage })))
const StarburstingPage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.StarburstingPage })))
const CausewayPage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.CausewayPage })))
const DimePage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.DimePage })))
const PestPage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.PestPage })))
const StakeholderPage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.StakeholderPage })))
const SurveillancePage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.SurveillancePage })))
const FundamentalFlowPage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.FundamentalFlowPage })))

// Tool pages (lazy loaded)
const EvidencePage = lazy(() => import('@/pages/EvidencePage').then(m => ({ default: m.EvidencePage })))
const DatasetPage = lazy(() => import('@/pages/DatasetPage').then(m => ({ default: m.DatasetPage })))
const ToolsPage = lazy(() => import('@/pages/ToolsPage').then(m => ({ default: m.ToolsPage })))
const WebScraperPage = lazy(() => import('@/pages/WebScraperPage').then(m => ({ default: m.WebScraperPage })))
const SocialMediaPage = lazy(() => import('@/pages/SocialMediaPage').then(m => ({ default: m.SocialMediaPage })))
const ContentExtractionPage = lazy(() => import('@/pages/tools/ContentExtractionPage').then(m => ({ default: m.ContentExtractionPage })))
const CitationsGeneratorPage = lazy(() => import('@/pages/tools/CitationsGeneratorPage').then(m => ({ default: m.CitationsGeneratorPage })))
const URLProcessingPage = lazy(() => import('@/pages/tools/URLProcessingPage').then(m => ({ default: m.URLProcessingPage })))
const BatchProcessingPage = lazy(() => import('@/pages/tools/BatchProcessingPage').then(m => ({ default: m.BatchProcessingPage })))

// Heavy pages (lazy loaded - only when needed)
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then(m => ({ default: m.ReportsPage })))
const NetworkGraphPage = lazy(() => import('@/pages/NetworkGraphPage').then(m => ({ default: m.NetworkGraphPage })))

// Other pages (lazy loaded)
const CollaborationPage = lazy(() => import('@/pages/CollaborationPage').then(m => ({ default: m.CollaborationPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const AISettingsPage = lazy(() => import('@/pages/AISettingsPage').then(m => ({ default: m.AISettingsPage })))
const InviteAcceptPage = lazy(() => import('@/pages/InviteAcceptPage').then(m => ({ default: m.InviteAcceptPage })))

// Entity pages (lazy loaded)
const ActorsPage = lazy(() => import('@/pages/entities/ActorsPage').then(m => ({ default: m.ActorsPage })))
const SourcesPage = lazy(() => import('@/pages/entities/SourcesPage').then(m => ({ default: m.SourcesPage })))
const EventsPage = lazy(() => import('@/pages/entities/EventsPage').then(m => ({ default: m.EventsPage })))

// ACH pages (lazy loaded)
const ACHPage = lazy(() => import('@/pages/ACHPage').then(m => ({ default: m.ACHPage })))
const ACHAnalysisPage = lazy(() => import('@/pages/ACHAnalysisPage').then(m => ({ default: m.ACHAnalysisPage })))

// Wrapper component for Suspense
const LazyPage = ({ Component }: { Component: React.LazyExoticComponent<React.ComponentType> }) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
)

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LazyPage Component={LandingPage} />,
  },
  {
    path: '/login',
    element: <LazyPage Component={LoginPage} />,
  },
  {
    path: '/register',
    element: <LazyPage Component={RegisterPage} />,
  },
  {
    path: '/invite/:inviteToken',
    element: <LazyPage Component={InviteAcceptPage} />,
  },
  {
    path: '/tools',
    element: <Navigate to="/dashboard/tools" replace />,
  },
  {
    path: '/dashboard',
    element: <DashboardLayout />,
    children: [
      {
        index: true,
        element: <LazyPage Component={DashboardPage} />,
      },
      // Analysis Framework Routes (relative paths)
      // Support list, create, view, and edit routes for each framework
      {
        path: 'analysis-frameworks/swot-dashboard',
        element: <LazyPage Component={SwotPage} />,
      },
      {
        path: 'analysis-frameworks/swot-dashboard/create',
        element: <LazyPage Component={SwotPage} />,
      },
      {
        path: 'analysis-frameworks/swot-dashboard/:id',
        element: <LazyPage Component={SwotPage} />,
      },
      {
        path: 'analysis-frameworks/swot-dashboard/:id/edit',
        element: <LazyPage Component={SwotPage} />,
      },
      {
        path: 'analysis-frameworks/ach-dashboard',
        element: <LazyPage Component={ACHPage} />,
      },
      {
        path: 'analysis-frameworks/ach-dashboard/:id',
        element: <LazyPage Component={ACHAnalysisPage} />,
      },
      {
        path: 'analysis-frameworks/cog',
        element: <LazyPage Component={CogPage} />,
      },
      {
        path: 'analysis-frameworks/cog/:action',
        element: <LazyPage Component={CogPage} />,
      },
      {
        path: 'analysis-frameworks/cog/:id/:action',
        element: <LazyPage Component={CogPage} />,
      },
      {
        path: 'analysis-frameworks/pmesii-pt',
        element: <LazyPage Component={PmesiiPtPage} />,
      },
      {
        path: 'analysis-frameworks/pmesii-pt/:action',
        element: <LazyPage Component={PmesiiPtPage} />,
      },
      {
        path: 'analysis-frameworks/pmesii-pt/:id/:action',
        element: <LazyPage Component={PmesiiPtPage} />,
      },
      {
        path: 'analysis-frameworks/dotmlpf',
        element: <LazyPage Component={DotmlpfPage} />,
      },
      {
        path: 'analysis-frameworks/dotmlpf/:action',
        element: <LazyPage Component={DotmlpfPage} />,
      },
      {
        path: 'analysis-frameworks/dotmlpf/:id/:action',
        element: <LazyPage Component={DotmlpfPage} />,
      },
      {
        path: 'analysis-frameworks/deception',
        element: <LazyPage Component={DeceptionPage} />,
      },
      {
        path: 'analysis-frameworks/deception/:action',
        element: <LazyPage Component={DeceptionPage} />,
      },
      {
        path: 'analysis-frameworks/deception/:id/:action',
        element: <LazyPage Component={DeceptionPage} />,
      },
      {
        path: 'analysis-frameworks/behavior',
        element: <LazyPage Component={BehaviorPage} />,
      },
      {
        path: 'analysis-frameworks/behavior/:action',
        element: <LazyPage Component={BehaviorPage} />,
      },
      {
        path: 'analysis-frameworks/behavior/:id/:action',
        element: <LazyPage Component={BehaviorPage} />,
      },
      {
        path: 'analysis-frameworks/starbursting',
        element: <LazyPage Component={StarburstingPage} />,
      },
      {
        path: 'analysis-frameworks/starbursting/:action',
        element: <LazyPage Component={StarburstingPage} />,
      },
      {
        path: 'analysis-frameworks/starbursting/:id/:action',
        element: <LazyPage Component={StarburstingPage} />,
      },
      {
        path: 'analysis-frameworks/causeway',
        element: <LazyPage Component={CausewayPage} />,
      },
      {
        path: 'analysis-frameworks/causeway/:action',
        element: <LazyPage Component={CausewayPage} />,
      },
      {
        path: 'analysis-frameworks/causeway/:id/:action',
        element: <LazyPage Component={CausewayPage} />,
      },
      {
        path: 'analysis-frameworks/dime',
        element: <LazyPage Component={DimePage} />,
      },
      {
        path: 'analysis-frameworks/dime/:action',
        element: <LazyPage Component={DimePage} />,
      },
      {
        path: 'analysis-frameworks/dime/:id/:action',
        element: <LazyPage Component={DimePage} />,
      },
      {
        path: 'analysis-frameworks/pest',
        element: <LazyPage Component={PestPage} />,
      },
      {
        path: 'analysis-frameworks/pest/:action',
        element: <LazyPage Component={PestPage} />,
      },
      {
        path: 'analysis-frameworks/pest/:id/:action',
        element: <LazyPage Component={PestPage} />,
      },
      {
        path: 'analysis-frameworks/stakeholder',
        element: <LazyPage Component={StakeholderPage} />,
      },
      {
        path: 'analysis-frameworks/stakeholder/:action',
        element: <LazyPage Component={StakeholderPage} />,
      },
      {
        path: 'analysis-frameworks/stakeholder/:id/:action',
        element: <LazyPage Component={StakeholderPage} />,
      },
      {
        path: 'analysis-frameworks/surveillance',
        element: <LazyPage Component={SurveillancePage} />,
      },
      {
        path: 'analysis-frameworks/surveillance/:action',
        element: <LazyPage Component={SurveillancePage} />,
      },
      {
        path: 'analysis-frameworks/surveillance/:id/:action',
        element: <LazyPage Component={SurveillancePage} />,
      },
      {
        path: 'analysis-frameworks/fundamental-flow',
        element: <LazyPage Component={FundamentalFlowPage} />,
      },
      {
        path: 'analysis-frameworks/fundamental-flow/:action',
        element: <LazyPage Component={FundamentalFlowPage} />,
      },
      {
        path: 'analysis-frameworks/fundamental-flow/:id/:action',
        element: <LazyPage Component={FundamentalFlowPage} />,
      },
      // Research Tools Routes
      {
        path: 'tools',
        element: <LazyPage Component={ToolsPage} />,
      },
      {
        path: 'tools/scraping',
        element: <LazyPage Component={WebScraperPage} />,
      },
      {
        path: 'tools/content-extraction',
        element: <LazyPage Component={ContentExtractionPage} />,
      },
      {
        path: 'tools/citations-generator',
        element: <LazyPage Component={CitationsGeneratorPage} />,
      },
      {
        path: 'tools/url',
        element: <LazyPage Component={URLProcessingPage} />,
      },
      {
        path: 'tools/batch-processing',
        element: <LazyPage Component={BatchProcessingPage} />,
      },
      {
        path: 'tools/social-media',
        element: <LazyPage Component={SocialMediaPage} />,
      },
      {
        path: 'tools/ach',
        element: <LazyPage Component={ACHPage} />,
      },
      {
        path: 'tools/ach/:id',
        element: <LazyPage Component={ACHAnalysisPage} />,
      },
      {
        path: 'tools/:toolId',
        element: <LazyPage Component={ToolsPage} />,
      },
      // Other Routes
      {
        path: 'evidence',
        element: <LazyPage Component={EvidencePage} />,
      },
      {
        path: 'datasets',
        element: <LazyPage Component={DatasetPage} />,
      },
      // Entity System Routes
      {
        path: 'entities/actors',
        element: <LazyPage Component={ActorsPage} />,
      },
      {
        path: 'entities/actors/:id',
        element: <LazyPage Component={ActorsPage} />,
      },
      {
        path: 'entities/actors/:id/edit',
        element: <LazyPage Component={ActorsPage} />,
      },
      {
        path: 'entities/sources',
        element: <LazyPage Component={SourcesPage} />,
      },
      {
        path: 'entities/sources/:id',
        element: <LazyPage Component={SourcesPage} />,
      },
      {
        path: 'entities/sources/:id/edit',
        element: <LazyPage Component={SourcesPage} />,
      },
      {
        path: 'entities/events',
        element: <LazyPage Component={EventsPage} />,
      },
      {
        path: 'entities/events/:id',
        element: <LazyPage Component={EventsPage} />,
      },
      {
        path: 'entities/events/:id/edit',
        element: <LazyPage Component={EventsPage} />,
      },
      // Network Analysis Route
      {
        path: 'network',
        element: <LazyPage Component={NetworkGraphPage} />,
      },
      {
        path: 'reports',
        element: <LazyPage Component={ReportsPage} />,
      },
      {
        path: 'collaboration',
        element: <LazyPage Component={CollaborationPage} />,
      },
      {
        path: 'settings',
        element: <LazyPage Component={SettingsPage} />,
      },
      {
        path: 'settings/ai',
        element: <LazyPage Component={AISettingsPage} />,
      },
    ],
  },
  // Catch-all 404 route
  {
    path: '*',
    element: <LazyPage Component={NotFoundPage} />,
  },
])