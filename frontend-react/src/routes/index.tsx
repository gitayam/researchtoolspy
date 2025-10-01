import { createBrowserRouter } from 'react-router-dom'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { EvidencePage } from '@/pages/EvidencePage'
import { ToolsPage } from '@/pages/ToolsPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { CollaborationPage } from '@/pages/CollaborationPage'
import { SettingsPage } from '@/pages/SettingsPage'
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
    path: '/dashboard',
    element: <DashboardLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      // Analysis Framework Routes (relative paths)
      {
        path: 'analysis-frameworks/swot-dashboard',
        element: <SwotPage />,
      },
      {
        path: 'analysis-frameworks/ach-dashboard',
        element: <AchPage />,
      },
      {
        path: 'analysis-frameworks/cog',
        element: <CogPage />,
      },
      {
        path: 'analysis-frameworks/pmesii-pt',
        element: <PmesiiPtPage />,
      },
      {
        path: 'analysis-frameworks/dotmlpf',
        element: <DotmlpfPage />,
      },
      {
        path: 'analysis-frameworks/deception',
        element: <DeceptionPage />,
      },
      {
        path: 'analysis-frameworks/behavior',
        element: <BehaviorPage />,
      },
      {
        path: 'analysis-frameworks/starbursting',
        element: <StarburstingPage />,
      },
      {
        path: 'analysis-frameworks/causeway',
        element: <CausewayPage />,
      },
      {
        path: 'analysis-frameworks/dime',
        element: <DimePage />,
      },
      {
        path: 'analysis-frameworks/pest',
        element: <PestPage />,
      },
      {
        path: 'analysis-frameworks/vrio',
        element: <VrioPage />,
      },
      {
        path: 'analysis-frameworks/stakeholder',
        element: <StakeholderPage />,
      },
      {
        path: 'analysis-frameworks/trend',
        element: <TrendPage />,
      },
      {
        path: 'analysis-frameworks/surveillance',
        element: <SurveillancePage />,
      },
      {
        path: 'analysis-frameworks/fundamental-flow',
        element: <FundamentalFlowPage />,
      },
      // Research Tools Routes
      {
        path: 'tools',
        element: <ToolsPage />,
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
])