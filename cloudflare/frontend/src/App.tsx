import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import './index.css';

// Layout
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import ReportsPage from './pages/ReportsPage';
import FrameworksPage from './pages/FrameworksPage';

// Framework Pages
import SwotListPage from './pages/frameworks/swot/ListPage';
import SwotCreatePage from './pages/frameworks/swot/CreatePage';
import SwotEditPage from './pages/frameworks/swot/EditPage';

import AchListPage from './pages/frameworks/ach/ListPage';
import AchCreatePage from './pages/frameworks/ach/CreatePage';
import AchEditPage from './pages/frameworks/ach/EditPage';

import PmesiiListPage from './pages/frameworks/pmesii/ListPage';
import PmesiiCreatePage from './pages/frameworks/pmesii/CreatePage';
import PmesiiEditPage from './pages/frameworks/pmesii/EditPage';

import DotmlpfListPage from './pages/frameworks/dotmlpf/ListPage';
import DotmlpfCreatePage from './pages/frameworks/dotmlpf/CreatePage';
import DotmlpfEditPage from './pages/frameworks/dotmlpf/EditPage';

import PestListPage from './pages/frameworks/pest/ListPage';
import PestCreatePage from './pages/frameworks/pest/CreatePage';
import PestEditPage from './pages/frameworks/pest/EditPage';

import VrioListPage from './pages/frameworks/vrio/ListPage';
import VrioCreatePage from './pages/frameworks/vrio/CreatePage';
import VrioEditPage from './pages/frameworks/vrio/EditPage';

import TrendListPage from './pages/frameworks/trend/ListPage';
import TrendCreatePage from './pages/frameworks/trend/CreatePage';
import TrendEditPage from './pages/frameworks/trend/EditPage';

import DimeListPage from './pages/frameworks/dime/ListPage';
import DimeCreatePage from './pages/frameworks/dime/CreatePage';
import DimeEditPage from './pages/frameworks/dime/EditPage';

import CogListPage from './pages/frameworks/cog/ListPage';
import CogCreatePage from './pages/frameworks/cog/CreatePage';
import CogEditPage from './pages/frameworks/cog/EditPage';

import StakeholderListPage from './pages/frameworks/stakeholder/ListPage';
import StakeholderCreatePage from './pages/frameworks/stakeholder/CreatePage';
import StakeholderEditPage from './pages/frameworks/stakeholder/EditPage';

import StarburstingListPage from './pages/frameworks/starbursting/ListPage';
import StarburstingCreatePage from './pages/frameworks/starbursting/CreatePage';
import StarburstingEditPage from './pages/frameworks/starbursting/EditPage';

import FundamentalFlowListPage from './pages/frameworks/fundamental-flow/ListPage';
import FundamentalFlowCreatePage from './pages/frameworks/fundamental-flow/CreatePage';
import FundamentalFlowEditPage from './pages/frameworks/fundamental-flow/EditPage';

import BehaviorListPage from './pages/frameworks/behavior/ListPage';
import BehaviorCreatePage from './pages/frameworks/behavior/CreatePage';
import BehaviorEditPage from './pages/frameworks/behavior/EditPage';

import CausewayListPage from './pages/frameworks/causeway/ListPage';
import CausewayEditPage from './pages/frameworks/causeway/EditPage';

import SurveillanceListPage from './pages/frameworks/surveillance/ListPage';
import SurveillanceCreatePage from './pages/frameworks/surveillance/CreatePage';
import SurveillanceEditPage from './pages/frameworks/surveillance/EditPage';

import DeceptionListPage from './pages/frameworks/deception/ListPage';
import DeceptionCreatePage from './pages/frameworks/deception/CreatePage';
import DeceptionEditPage from './pages/frameworks/deception/EditPage';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Routes */}
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<HomePage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="frameworks" element={<FrameworksPage />} />

            {/* SWOT Framework */}
            <Route path="frameworks/swot" element={<SwotListPage />} />
            <Route path="frameworks/swot/create" element={<SwotCreatePage />} />
            <Route path="frameworks/swot/:id" element={<SwotEditPage />} />

            {/* ACH Framework */}
            <Route path="frameworks/ach" element={<AchListPage />} />
            <Route path="frameworks/ach/create" element={<AchCreatePage />} />
            <Route path="frameworks/ach/:id" element={<AchEditPage />} />

            {/* PMESII-PT Framework */}
            <Route path="frameworks/pmesii-pt" element={<PmesiiListPage />} />
            <Route path="frameworks/pmesii-pt/create" element={<PmesiiCreatePage />} />
            <Route path="frameworks/pmesii-pt/:id" element={<PmesiiEditPage />} />

            {/* DOTMLPF Framework */}
            <Route path="frameworks/dotmlpf" element={<DotmlpfListPage />} />
            <Route path="frameworks/dotmlpf/create" element={<DotmlpfCreatePage />} />
            <Route path="frameworks/dotmlpf/:id" element={<DotmlpfEditPage />} />

            {/* PEST Framework */}
            <Route path="frameworks/pest" element={<PestListPage />} />
            <Route path="frameworks/pest/create" element={<PestCreatePage />} />
            <Route path="frameworks/pest/:id" element={<PestEditPage />} />

            {/* VRIO Framework */}
            <Route path="frameworks/vrio" element={<VrioListPage />} />
            <Route path="frameworks/vrio/create" element={<VrioCreatePage />} />
            <Route path="frameworks/vrio/:id" element={<VrioEditPage />} />

            {/* Trend Framework */}
            <Route path="frameworks/trend" element={<TrendListPage />} />
            <Route path="frameworks/trend/create" element={<TrendCreatePage />} />
            <Route path="frameworks/trend/:id" element={<TrendEditPage />} />

            {/* DIME Framework */}
            <Route path="frameworks/dime" element={<DimeListPage />} />
            <Route path="frameworks/dime/create" element={<DimeCreatePage />} />
            <Route path="frameworks/dime/:id" element={<DimeEditPage />} />

            {/* COG Framework */}
            <Route path="frameworks/cog" element={<CogListPage />} />
            <Route path="frameworks/cog/create" element={<CogCreatePage />} />
            <Route path="frameworks/cog/:id" element={<CogEditPage />} />

            {/* Stakeholder Framework */}
            <Route path="frameworks/stakeholder" element={<StakeholderListPage />} />
            <Route path="frameworks/stakeholder/create" element={<StakeholderCreatePage />} />
            <Route path="frameworks/stakeholder/:id" element={<StakeholderEditPage />} />

            {/* Starbursting Framework */}
            <Route path="frameworks/starbursting" element={<StarburstingListPage />} />
            <Route path="frameworks/starbursting/create" element={<StarburstingCreatePage />} />
            <Route path="frameworks/starbursting/:id" element={<StarburstingEditPage />} />

            {/* Fundamental Flow Framework */}
            <Route path="frameworks/fundamental-flow" element={<FundamentalFlowListPage />} />
            <Route path="frameworks/fundamental-flow/create" element={<FundamentalFlowCreatePage />} />
            <Route path="frameworks/fundamental-flow/:id" element={<FundamentalFlowEditPage />} />

            {/* Behavior Framework */}
            <Route path="frameworks/behavior" element={<BehaviorListPage />} />
            <Route path="frameworks/behavior/create" element={<BehaviorCreatePage />} />
            <Route path="frameworks/behavior/:id" element={<BehaviorEditPage />} />

            {/* Causeway Framework */}
            <Route path="frameworks/causeway" element={<CausewayListPage />} />
            <Route path="frameworks/causeway/:id" element={<CausewayEditPage />} />

            {/* Surveillance Framework */}
            <Route path="frameworks/surveillance" element={<SurveillanceListPage />} />
            <Route path="frameworks/surveillance/create" element={<SurveillanceCreatePage />} />
            <Route path="frameworks/surveillance/:id" element={<SurveillanceEditPage />} />

            {/* Deception Framework */}
            <Route path="frameworks/deception" element={<DeceptionListPage />} />
            <Route path="frameworks/deception/create" element={<DeceptionCreatePage />} />
            <Route path="frameworks/deception/:id" element={<DeceptionEditPage />} />
          </Route>

          {/* Catch all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;