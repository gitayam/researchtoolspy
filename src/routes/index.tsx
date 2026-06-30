import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, useParams } from 'react-router-dom'
import { DashboardLayout, DashboardFullBleedLayout } from '@/layouts/DashboardLayout'
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary'

// Legacy redirect: /dashboard/surveys/:id → /dashboard/drops/:id
function LegacySurveyRedirect() {
  const { id } = useParams()
  return <Navigate to={`/dashboard/drops/${id}`} replace />
}

// Legacy public submit page (System B) was retired — the old `/submit/:hashId`
// hash IDs do not map to System-A survey tokens, so we can't redirect; show a
// graceful notice instead of a dead page.
function SubmissionFormMovedNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          This submission form is no longer available
        </h1>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Please use the link the form&rsquo;s owner shared with you. If you
          don&rsquo;t have a current link, contact them to request a new one.
        </p>
      </div>
    </main>
  )
}

// Enhanced loading fallback component with progress indicator
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
    <div className="text-center max-w-md px-4">
      {/* Spinner */}
      <div className="relative mx-auto mb-6">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 dark:border-gray-700"></div>
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent absolute top-0 left-0"></div>
      </div>

      {/* Loading text with animation */}
      <div className="space-y-2">
        <p className="text-lg font-semibold text-gray-900 dark:text-white animate-pulse">
          Loading
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Please wait while we prepare your content...
        </p>
      </div>

      {/* Progress bar */}
      <div className="mt-6 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
        <div className="h-full bg-blue-600 animate-progress-indeterminate"></div>
      </div>
    </div>
  </div>
)

// Lazy load all pages for better code splitting
// Core pages (keep these loaded for initial nav)
const LandingPage = lazy(() => import('@/pages/LandingPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/pages/RegisterPage').then(m => ({ default: m.RegisterPage })))
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage').then(m => ({ default: m.AuthCallbackPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })))

// Framework pages (lazy loaded)
const SwotPage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.SwotPage })))
const CogPage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.CogPage })))
const PmesiiPtPage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.PmesiiPtPage })))
const DotmlpfPage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.DotmlpfPage })))
const DeceptionPage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.DeceptionPage })))
const DeceptionRiskDashboard = lazy(() => import('@/pages/DeceptionRiskDashboard'))
const BehaviorPage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.BehaviorPage })))
const COMBAnalysisPage = lazy(() => import('@/pages/frameworks').then(m => ({ default: m.COMBAnalysisPage })))
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
const RageCheckPage = lazy(() => import('@/pages/tools/RageCheckPage').then(m => ({ default: m.RageCheckPage })))
const URLProcessingPage = lazy(() => import('@/pages/tools/URLProcessingPage').then(m => ({ default: m.URLProcessingPage })))
const BatchProcessingPage = lazy(() => import('@/pages/tools/BatchProcessingPage').then(m => ({ default: m.BatchProcessingPage })))
const ContentIntelligencePage = lazy(() => import('@/pages/tools/ContentIntelligencePage'))
const ResearchQuestionGeneratorPage = lazy(() => import('@/pages/ResearchQuestionGeneratorPage'))
const BehaviorAnalysisToolPage = lazy(() => import('@/pages/BehaviorAnalysisToolPage'))
const ResearchWorkspacePage = lazy(() => import('@/pages/ResearchWorkspacePage'))
const EvidenceSubmissionsPage = lazy(() => import('@/pages/EvidenceSubmissionsPage'))
const ResearchFormBuilderPage = lazy(() => import('@/pages/ResearchFormBuilderPage'))
const EquilibriumAnalysisPage = lazy(() => import('@/pages/tools/EquilibriumAnalysisPage'))
const HamiltonRulePage = lazy(() => import('@/pages/tools/HamiltonRulePage'))
const CollectionPage = lazy(() => import('@/pages/tools/CollectionPage'))
const CrossTablePage = lazy(() => import('@/pages/tools/CrossTablePage'))
const EmailHeaderAnalyzerPage = lazy(() => import('@/pages/tools/EmailHeaderAnalyzerPage'))
const IntelligenceSynthesisPage = lazy(() => import('@/pages/IntelligenceSynthesisPage'))

// COP pages (lazy loaded)
const CopListPage = lazy(() => import('@/pages/CopListPage'))
const CopWorkspacePage = lazy(() => import('@/pages/CopWorkspacePage'))

// Drop pages (lazy loaded)
const SurveyListPage = lazy(() => import('@/pages/SurveyListPage'))
const SurveyDetailPage = lazy(() => import('@/pages/SurveyDetailPage'))

// Heavy pages (lazy loaded - only when needed)
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then(m => ({ default: m.ReportsPage })))
const NetworkGraphPage = lazy(() => import('@/pages/NetworkGraphPage').then(m => ({ default: m.NetworkGraphPage })))

// Other pages (lazy loaded)
const CollaborationPage = lazy(() => import('@/pages/CollaborationPage').then(m => ({ default: m.CollaborationPage })))
const ActivityPage = lazy(() => import('@/pages/ActivityPage').then(m => ({ default: m.ActivityPage })))
const InvestigationPacketsPage = lazy(() => import('@/pages/InvestigationPacketsPage').then(m => ({ default: m.InvestigationPacketsPage })))
const InvestigationDetailPage = lazy(() => import('@/pages/InvestigationDetailPage').then(m => ({ default: m.InvestigationDetailPage })))
const InvestigationsPage = lazy(() => import('@/pages/InvestigationsPage'))
const NewInvestigationPage = lazy(() => import('@/pages/NewInvestigationPage'))
const NewWorkspacePage = lazy(() => import('@/pages/NewWorkspacePage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const AISettingsPage = lazy(() => import('@/pages/AISettingsPage').then(m => ({ default: m.AISettingsPage })))
const InviteAcceptPage = lazy(() => import('@/pages/InviteAcceptPage').then(m => ({ default: m.InviteAcceptPage })))

// Entity pages (lazy loaded)
const ActorsPage = lazy(() => import('@/pages/entities/ActorsPage').then(m => ({ default: m.ActorsPage })))
const SourcesPage = lazy(() => import('@/pages/entities/SourcesPage').then(m => ({ default: m.SourcesPage })))
const EventsPage = lazy(() => import('@/pages/entities/EventsPage').then(m => ({ default: m.EventsPage })))
const ClaimsPage = lazy(() => import('@/pages/entities/ClaimsPage').then(m => ({ default: m.ClaimsPage })))

// ACH pages (lazy loaded)
const ACHPage = lazy(() => import('@/pages/ACHPage').then(m => ({ default: m.ACHPage })))
const ACHAnalysisPage = lazy(() => import('@/pages/ACHAnalysisPage').then(m => ({ default: m.ACHAnalysisPage })))

// Public pages (lazy loaded - no auth required)
const PublicFrameworkPage = lazy(() => import('@/pages/PublicFrameworkPage').then(m => ({ default: m.PublicFrameworkPage })))
const PublicSharedBehaviorPage = lazy(() => import('@/pages/PublicSharedBehaviorPage').then(m => ({ default: m.PublicSharedBehaviorPage })))
const PublicACHPage = lazy(() => import('@/pages/PublicACHPage').then(m => ({ default: m.PublicACHPage })))
const PublicACHLibraryPage = lazy(() => import('@/pages/PublicACHLibraryPage').then(m => ({ default: m.PublicACHLibraryPage })))
const PublicContentAnalysisPage = lazy(() => import('@/pages/PublicContentAnalysisPage').then(m => ({ default: m.PublicContentAnalysisPage })))
const PublicCopPage = lazy(() => import('@/pages/PublicCopPage'))
const PublicCrossTablePage = lazy(() => import('@/pages/tools/PublicCrossTablePage'))
const PublicIntakePage = lazy(() => import('@/pages/PublicIntakePage'))
const PublicDropFormPage = lazy(() => import('@/pages/PublicDropFormPage'))
const DropLandingPage = lazy(() => import('@/pages/DropLandingPage'))

// Library pages (lazy loaded)
const PublicLibraryPage = lazy(() => import('@/pages/PublicLibraryPage').then(m => ({ default: m.PublicLibraryPage })))
const ContentLibraryPage = lazy(() => import('@/pages/ContentLibraryPage').then(m => ({ default: m.ContentLibraryPage })))

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
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/login',
    element: <LazyPage Component={LoginPage} />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/register',
    element: <LazyPage Component={RegisterPage} />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/auth/callback',
    element: <LazyPage Component={AuthCallbackPage} />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/invite/:inviteToken',
    element: <LazyPage Component={InviteAcceptPage} />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/public/framework/:token',
    element: <LazyPage Component={PublicFrameworkPage} />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    // Public read-only viewer for behavior analyses stored via the
    // signal-bot's `!bcw` round-trip. UUID is the access token.
    path: '/shared/behavior/:id',
    element: <LazyPage Component={PublicSharedBehaviorPage} />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/public/ach',
    element: <LazyPage Component={PublicACHLibraryPage} />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/public/ach/:token',
    element: <LazyPage Component={PublicACHPage} />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/public/content-analysis/:token',
    element: <LazyPage Component={PublicContentAnalysisPage} />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/public/cop/:token',
    element: <LazyPage Component={PublicCopPage} />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/public/cross-table/:token',
    element: <LazyPage Component={PublicCrossTablePage} />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/public/intake/:token',
    element: <LazyPage Component={PublicIntakePage} />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/drop',
    element: <LazyPage Component={DropLandingPage} />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    // E-11: /drop/:token renders the anonymous tip-line form (isDropMode=true)
    path: '/drop/:slugOrToken',
    element: <LazyPage Component={PublicDropFormPage} />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/survey/:slugOrToken',
    element: <LazyPage Component={PublicIntakePage} />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    // Legacy System-B public submit route — retired. Hash IDs don't map to
    // System-A survey tokens, so we show a notice instead of redirecting.
    path: '/submit/:hashId',
    element: <SubmissionFormMovedNotice />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/tools',
    element: <Navigate to="/dashboard/tools" replace />,
  },
  {
    path: '/dashboard/cop/:id',
    element: <DashboardFullBleedLayout />,
    children: [
      { index: true, element: <LazyPage Component={CopWorkspacePage} />, errorElement: <RouteErrorBoundary /> },
    ],
  },
  {
    path: '/dashboard',
    element: <DashboardLayout />,
    children: [
      {
        index: true,
        element: <LazyPage Component={DashboardPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      // Analysis Framework Routes (relative paths)
      // Support list, create, view, and edit routes for each framework
      {
        path: 'analysis-frameworks/swot-dashboard',
        element: <LazyPage Component={SwotPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/swot-dashboard/create',
        element: <LazyPage Component={SwotPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/swot-dashboard/:id',
        element: <LazyPage Component={SwotPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/swot-dashboard/:id/edit',
        element: <LazyPage Component={SwotPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/ach-dashboard',
        element: <LazyPage Component={ACHPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/ach-dashboard/:id',
        element: <LazyPage Component={ACHAnalysisPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/cog',
        element: <LazyPage Component={CogPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/cog/create',
        element: <LazyPage Component={CogPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/cog/:id',
        element: <LazyPage Component={CogPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/cog/:id/edit',
        element: <LazyPage Component={CogPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/pmesii-pt',
        element: <LazyPage Component={PmesiiPtPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/pmesii-pt/:action',
        element: <LazyPage Component={PmesiiPtPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/pmesii-pt/:id/:action',
        element: <LazyPage Component={PmesiiPtPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/dotmlpf',
        element: <LazyPage Component={DotmlpfPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/dotmlpf/:action',
        element: <LazyPage Component={DotmlpfPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/dotmlpf/:id/:action',
        element: <LazyPage Component={DotmlpfPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'deception-risk',
        element: <LazyPage Component={DeceptionRiskDashboard} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/deception',
        element: <LazyPage Component={DeceptionPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/deception/:action',
        element: <LazyPage Component={DeceptionPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/deception/:id/:action',
        element: <LazyPage Component={DeceptionPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/behavior',
        element: <LazyPage Component={BehaviorPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/behavior/:action',
        element: <LazyPage Component={BehaviorPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/behavior/:id/:action',
        element: <LazyPage Component={BehaviorPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/comb-analysis',
        element: <LazyPage Component={COMBAnalysisPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/comb-analysis/:action',
        element: <LazyPage Component={COMBAnalysisPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/comb-analysis/:id/:action',
        element: <LazyPage Component={COMBAnalysisPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/starbursting',
        element: <LazyPage Component={StarburstingPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/starbursting/:action',
        element: <LazyPage Component={StarburstingPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/starbursting/:id/:action',
        element: <LazyPage Component={StarburstingPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/causeway',
        element: <LazyPage Component={CausewayPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/causeway/:action',
        element: <LazyPage Component={CausewayPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/causeway/:id/:action',
        element: <LazyPage Component={CausewayPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/dime',
        element: <LazyPage Component={DimePage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/dime/:action',
        element: <LazyPage Component={DimePage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/dime/:id/:action',
        element: <LazyPage Component={DimePage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/pest',
        element: <LazyPage Component={PestPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/pest/:action',
        element: <LazyPage Component={PestPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/pest/:id/:action',
        element: <LazyPage Component={PestPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/stakeholder',
        element: <LazyPage Component={StakeholderPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/stakeholder/:action',
        element: <LazyPage Component={StakeholderPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/stakeholder/:id/:action',
        element: <LazyPage Component={StakeholderPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/surveillance',
        element: <LazyPage Component={SurveillancePage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/surveillance/:action',
        element: <LazyPage Component={SurveillancePage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/surveillance/:id/:action',
        element: <LazyPage Component={SurveillancePage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/fundamental-flow',
        element: <LazyPage Component={FundamentalFlowPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/fundamental-flow/:action',
        element: <LazyPage Component={FundamentalFlowPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'analysis-frameworks/fundamental-flow/:id/:action',
        element: <LazyPage Component={FundamentalFlowPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      // Research Tools Routes
      {
        path: 'tools',
        element: <LazyPage Component={ToolsPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/scraping',
        element: <LazyPage Component={WebScraperPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/content-intelligence',
        element: <LazyPage Component={ContentIntelligencePage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/content-extraction',
        element: <LazyPage Component={ContentExtractionPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/citations-generator',
        element: <LazyPage Component={CitationsGeneratorPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/url',
        element: <LazyPage Component={URLProcessingPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/rage-check',
        element: <LazyPage Component={RageCheckPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/batch-processing',
        element: <LazyPage Component={BatchProcessingPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/equilibrium-analysis',
        element: <LazyPage Component={EquilibriumAnalysisPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/hamilton-rule',
        element: <LazyPage Component={HamiltonRulePage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/collection',
        element: <LazyPage Component={CollectionPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/email-header-analyzer',
        element: <LazyPage Component={EmailHeaderAnalyzerPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      // Cross Table Routes
      {
        path: 'tools/cross-table',
        element: <LazyPage Component={CrossTablePage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/cross-table/new',
        element: <LazyPage Component={CrossTablePage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/cross-table/:id',
        element: <LazyPage Component={CrossTablePage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/cross-table/:id/score',
        element: <LazyPage Component={CrossTablePage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/social-media',
        element: <LazyPage Component={SocialMediaPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/ach',
        element: <LazyPage Component={ACHPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/ach/:id',
        element: <LazyPage Component={ACHAnalysisPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/research-question-generator',
        element: <LazyPage Component={ResearchQuestionGeneratorPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/behavior-analysis',
        element: <LazyPage Component={BehaviorAnalysisToolPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'research/workspace/:id',
        element: <LazyPage Component={ResearchWorkspacePage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'research/submissions',
        element: <LazyPage Component={EvidenceSubmissionsPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        // E-2: the forms-list lived at an unregistered route (404) via the dead
        // SubmissionFormsPage. The submissions page already has a working Forms tab,
        // so redirect here instead of resurrecting a redundant/auth-broken page.
        path: 'research/forms',
        element: <Navigate to="/dashboard/research/submissions" replace />,
      },
      {
        path: 'research/forms/new',
        element: <LazyPage Component={ResearchFormBuilderPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'tools/:toolId',
        element: <LazyPage Component={ToolsPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      // Other Routes
      {
        path: 'evidence',
        element: <LazyPage Component={EvidencePage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'datasets',
        element: <LazyPage Component={DatasetPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      // Entity System Routes
      {
        path: 'entities/actors',
        element: <LazyPage Component={ActorsPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'entities/actors/:id',
        element: <LazyPage Component={ActorsPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'entities/actors/:id/edit',
        element: <LazyPage Component={ActorsPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'entities/sources',
        element: <LazyPage Component={SourcesPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'entities/sources/:id',
        element: <LazyPage Component={SourcesPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'entities/sources/:id/edit',
        element: <LazyPage Component={SourcesPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'entities/events',
        element: <LazyPage Component={EventsPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'entities/events/:id',
        element: <LazyPage Component={EventsPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'entities/events/:id/edit',
        element: <LazyPage Component={EventsPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'entities/claims',
        element: <LazyPage Component={ClaimsPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'entities/claims/:id',
        element: <LazyPage Component={ClaimsPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'entities/claims/:id/edit',
        element: <LazyPage Component={ClaimsPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      // Network Analysis Route
      {
        path: 'network',
        element: <LazyPage Component={NetworkGraphPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'network-graph',
        element: <Navigate to="/dashboard/network" replace />,
      },
      {
        path: 'reports',
        element: <LazyPage Component={ReportsPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'library',
        children: [
          {
            index: true,
            element: <LazyPage Component={PublicLibraryPage} />,
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: 'content',
            element: <LazyPage Component={ContentLibraryPage} />,
            errorElement: <RouteErrorBoundary />,
          },
        ],
      },
      {
        path: 'collaboration',
        element: <LazyPage Component={CollaborationPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'activity',
        element: <LazyPage Component={ActivityPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'intelligence',
        element: <LazyPage Component={IntelligenceSynthesisPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      // Drop Routes
      {
        path: 'drops',
        element: <LazyPage Component={SurveyListPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'drops/:id',
        element: <LazyPage Component={SurveyDetailPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      // Legacy survey routes (redirect)
      {
        path: 'surveys',
        element: <Navigate to="/dashboard/drops" replace />,
      },
      {
        path: 'surveys/:id',
        element: <LegacySurveyRedirect />,
        errorElement: <RouteErrorBoundary />,
      },
      // COP Routes
      {
        path: 'cop',
        element: <LazyPage Component={CopListPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'investigations',
        element: <LazyPage Component={InvestigationsPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'investigations/new',
        element: <Navigate to="/dashboard/workspace/new" replace />,
      },
      {
        path: 'workspace/new',
        element: <LazyPage Component={NewWorkspacePage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'investigations/:id',
        element: <LazyPage Component={InvestigationDetailPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'settings',
        element: <LazyPage Component={SettingsPage} />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'settings/ai',
        element: <LazyPage Component={AISettingsPage} />,
        errorElement: <RouteErrorBoundary />,
      },
    ],
  },
  // Catch-all 404 route
  {
    path: '*',
    element: <LazyPage Component={NotFoundPage} />,
    errorElement: <RouteErrorBoundary />,
  },
])