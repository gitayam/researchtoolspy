import { createBrowserRouter } from 'react-router-dom'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { DashboardPage } from '@/pages/DashboardPage'
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
      // Analysis Framework Routes
      {
        path: '/dashboard/analysis-frameworks/swot-dashboard',
        element: <SwotPage />,
      },
      {
        path: '/dashboard/analysis-frameworks/ach-dashboard',
        element: <AchPage />,
      },
      {
        path: '/dashboard/analysis-frameworks/cog',
        element: <CogPage />,
      },
      {
        path: '/dashboard/analysis-frameworks/pmesii-pt',
        element: <PmesiiPtPage />,
      },
      {
        path: '/dashboard/analysis-frameworks/dotmlpf',
        element: <DotmlpfPage />,
      },
      {
        path: '/dashboard/analysis-frameworks/deception',
        element: <DeceptionPage />,
      },
      {
        path: '/dashboard/analysis-frameworks/behavior',
        element: <BehaviorPage />,
      },
      {
        path: '/dashboard/analysis-frameworks/starbursting',
        element: <StarburstingPage />,
      },
      {
        path: '/dashboard/analysis-frameworks/causeway',
        element: <CausewayPage />,
      },
      {
        path: '/dashboard/analysis-frameworks/dime',
        element: <DimePage />,
      },
      {
        path: '/dashboard/analysis-frameworks/pest',
        element: <PestPage />,
      },
      {
        path: '/dashboard/analysis-frameworks/vrio',
        element: <VrioPage />,
      },
      {
        path: '/dashboard/analysis-frameworks/stakeholder',
        element: <StakeholderPage />,
      },
      {
        path: '/dashboard/analysis-frameworks/trend',
        element: <TrendPage />,
      },
      {
        path: '/dashboard/analysis-frameworks/surveillance',
        element: <SurveillancePage />,
      },
      {
        path: '/dashboard/analysis-frameworks/fundamental-flow',
        element: <FundamentalFlowPage />,
      },
    ],
  },
])