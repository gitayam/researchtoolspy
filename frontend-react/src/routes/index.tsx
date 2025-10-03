import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { EvidencePage } from '@/pages/EvidencePage'
import { DatasetPage } from '@/pages/DatasetPage'
import { ToolsPage } from '@/pages/ToolsPage'
import { WebScraperPage } from '@/pages/WebScraperPage'
import { SocialMediaPage } from '@/pages/SocialMediaPage'
import { ContentExtractionPage } from '@/pages/tools/ContentExtractionPage'
import { CitationsGeneratorPage } from '@/pages/tools/CitationsGeneratorPage'
import { URLProcessingPage } from '@/pages/tools/URLProcessingPage'
import { BatchProcessingPage } from '@/pages/tools/BatchProcessingPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { CollaborationPage } from '@/pages/CollaborationPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import {
  SwotPage,
  AchPage,
  CogPage,
  PmesiiPtPage,
  DotmlpfPage,
  DeceptionPage,
  BehaviorPage,
  StarburstingPage,
  CausewayPage,
  DimePage,
  PestPage,
  VrioPage,
  StakeholderPage,
  TrendPage,
  SurveillancePage,
  FundamentalFlowPage,
} from '@/pages/frameworks'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
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
        element: <DashboardPage />,
      },
      // Analysis Framework Routes (relative paths)
      // Support list, create, view, and edit routes for each framework
      {
        path: 'analysis-frameworks/swot-dashboard',
        element: <SwotPage />,
      },
      {
        path: 'analysis-frameworks/swot-dashboard/create',
        element: <SwotPage />,
      },
      {
        path: 'analysis-frameworks/swot-dashboard/:id',
        element: <SwotPage />,
      },
      {
        path: 'analysis-frameworks/swot-dashboard/:id/edit',
        element: <SwotPage />,
      },
      {
        path: 'analysis-frameworks/ach-dashboard',
        element: <AchPage />,
      },
      {
        path: 'analysis-frameworks/ach-dashboard/:action',
        element: <AchPage />,
      },
      {
        path: 'analysis-frameworks/ach-dashboard/:id/:action',
        element: <AchPage />,
      },
      {
        path: 'analysis-frameworks/cog',
        element: <CogPage />,
      },
      {
        path: 'analysis-frameworks/cog/:action',
        element: <CogPage />,
      },
      {
        path: 'analysis-frameworks/cog/:id/:action',
        element: <CogPage />,
      },
      {
        path: 'analysis-frameworks/pmesii-pt',
        element: <PmesiiPtPage />,
      },
      {
        path: 'analysis-frameworks/pmesii-pt/:action',
        element: <PmesiiPtPage />,
      },
      {
        path: 'analysis-frameworks/pmesii-pt/:id/:action',
        element: <PmesiiPtPage />,
      },
      {
        path: 'analysis-frameworks/dotmlpf',
        element: <DotmlpfPage />,
      },
      {
        path: 'analysis-frameworks/dotmlpf/:action',
        element: <DotmlpfPage />,
      },
      {
        path: 'analysis-frameworks/dotmlpf/:id/:action',
        element: <DotmlpfPage />,
      },
      {
        path: 'analysis-frameworks/deception',
        element: <DeceptionPage />,
      },
      {
        path: 'analysis-frameworks/deception/:action',
        element: <DeceptionPage />,
      },
      {
        path: 'analysis-frameworks/deception/:id/:action',
        element: <DeceptionPage />,
      },
      {
        path: 'analysis-frameworks/behavior',
        element: <BehaviorPage />,
      },
      {
        path: 'analysis-frameworks/behavior/:action',
        element: <BehaviorPage />,
      },
      {
        path: 'analysis-frameworks/behavior/:id/:action',
        element: <BehaviorPage />,
      },
      {
        path: 'analysis-frameworks/starbursting',
        element: <StarburstingPage />,
      },
      {
        path: 'analysis-frameworks/starbursting/:action',
        element: <StarburstingPage />,
      },
      {
        path: 'analysis-frameworks/starbursting/:id/:action',
        element: <StarburstingPage />,
      },
      {
        path: 'analysis-frameworks/causeway',
        element: <CausewayPage />,
      },
      {
        path: 'analysis-frameworks/causeway/:action',
        element: <CausewayPage />,
      },
      {
        path: 'analysis-frameworks/causeway/:id/:action',
        element: <CausewayPage />,
      },
      {
        path: 'analysis-frameworks/dime',
        element: <DimePage />,
      },
      {
        path: 'analysis-frameworks/dime/:action',
        element: <DimePage />,
      },
      {
        path: 'analysis-frameworks/dime/:id/:action',
        element: <DimePage />,
      },
      {
        path: 'analysis-frameworks/pest',
        element: <PestPage />,
      },
      {
        path: 'analysis-frameworks/pest/:action',
        element: <PestPage />,
      },
      {
        path: 'analysis-frameworks/pest/:id/:action',
        element: <PestPage />,
      },
      {
        path: 'analysis-frameworks/vrio',
        element: <VrioPage />,
      },
      {
        path: 'analysis-frameworks/vrio/:action',
        element: <VrioPage />,
      },
      {
        path: 'analysis-frameworks/vrio/:id/:action',
        element: <VrioPage />,
      },
      {
        path: 'analysis-frameworks/stakeholder',
        element: <StakeholderPage />,
      },
      {
        path: 'analysis-frameworks/stakeholder/:action',
        element: <StakeholderPage />,
      },
      {
        path: 'analysis-frameworks/stakeholder/:id/:action',
        element: <StakeholderPage />,
      },
      {
        path: 'analysis-frameworks/trend',
        element: <TrendPage />,
      },
      {
        path: 'analysis-frameworks/trend/:action',
        element: <TrendPage />,
      },
      {
        path: 'analysis-frameworks/trend/:id/:action',
        element: <TrendPage />,
      },
      {
        path: 'analysis-frameworks/surveillance',
        element: <SurveillancePage />,
      },
      {
        path: 'analysis-frameworks/surveillance/:action',
        element: <SurveillancePage />,
      },
      {
        path: 'analysis-frameworks/surveillance/:id/:action',
        element: <SurveillancePage />,
      },
      {
        path: 'analysis-frameworks/fundamental-flow',
        element: <FundamentalFlowPage />,
      },
      {
        path: 'analysis-frameworks/fundamental-flow/:action',
        element: <FundamentalFlowPage />,
      },
      {
        path: 'analysis-frameworks/fundamental-flow/:id/:action',
        element: <FundamentalFlowPage />,
      },
      // Research Tools Routes
      {
        path: 'tools',
        element: <ToolsPage />,
      },
      {
        path: 'tools/scraping',
        element: <WebScraperPage />,
      },
      {
        path: 'tools/content-extraction',
        element: <ContentExtractionPage />,
      },
      {
        path: 'tools/citations-generator',
        element: <CitationsGeneratorPage />,
      },
      {
        path: 'tools/url',
        element: <URLProcessingPage />,
      },
      {
        path: 'tools/batch-processing',
        element: <BatchProcessingPage />,
      },
      {
        path: 'tools/social-media',
        element: <SocialMediaPage />,
      },
      {
        path: 'tools/:toolId',
        element: <ToolsPage />,
      },
      // Other Routes
      {
        path: 'evidence',
        element: <EvidencePage />,
      },
      {
        path: 'datasets',
        element: <DatasetPage />,
      },
      {
        path: 'reports',
        element: <ReportsPage />,
      },
      {
        path: 'collaboration',
        element: <CollaborationPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
  // Catch-all 404 route
  {
    path: '*',
    element: <NotFoundPage />,
  },
])