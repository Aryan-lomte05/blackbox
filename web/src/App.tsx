import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AuthModal } from './components/auth/AuthModal';

import { Sidebar } from './components/common/Sidebar';
import { Header } from './components/common/Header';
import { CommandPalette } from './components/common/CommandPalette';

import { LandingPage } from './screens/LandingPage';
import { OverviewScreen } from './screens/OverviewScreen';
import { RunsScreen } from './screens/RunsScreen';
import { RunGraphScreen } from './screens/RunGraphScreen';
import { LiveLabScreen } from './screens/LiveLabScreen';
import { FleetFixScreen } from './screens/FleetFixScreen';
import { AtlasScreen } from './screens/AtlasScreen';
import { IncidentsScreen } from './screens/IncidentsScreen';
import { DatasetScreen } from './screens/DatasetScreen';

import { MachineScreen } from './screens/MachineScreen';
import { ApiScreen } from './screens/ApiScreen';
import { CheckerScreen } from './screens/CheckerScreen';
import { ModelsScreen } from './screens/ModelsScreen';
import { CompareScreen } from './screens/CompareScreen';

import { InvestigateScreen } from './screens/InvestigateScreen';
import { CausalScreen } from './screens/CausalScreen';
import { CrashTestScreen } from './screens/CrashTestScreen';
import { SimilarScreen } from './screens/SimilarScreen';
import { ComponentsDevScreen } from './screens/ComponentsDevScreen';

const DashboardLayout: React.FC = () => {
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex">
        {/* Left fixed 232px sidebar */}
        <Sidebar />

        {/* Main content area offset by 232px */}
        <div className="flex-1 ml-[232px] min-h-screen flex flex-col">
          <Header onOpenPalette={() => setPaletteOpen(true)} />
          <main className="flex-1 bg-[var(--bg)] px-6 py-6 max-w-[1280px] w-full mx-auto">
            <Outlet />
          </main>
        </div>

        {/* Global ⌘K Command Palette */}
        <CommandPalette
          isOpen={paletteOpen}
          onClose={() => setPaletteOpen(false)}
        />
      </div>
    </ProtectedRoute>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Master Public Landing Page */}
            <Route path="/" element={<LandingPage />} />

            {/* Authenticated Dashboard Partition */}
            <Route element={<DashboardLayout />}>
              <Route path="/overview" element={<OverviewScreen />} />
              <Route path="/runs" element={<RunsScreen />} />
              <Route path="/runs/:id" element={<RunGraphScreen />} />
              <Route path="/lab" element={<LiveLabScreen />} />
              <Route path="/fleet" element={<FleetFixScreen />} />
              <Route path="/atlas" element={<AtlasScreen />} />
              <Route path="/incidents" element={<IncidentsScreen />} />
              <Route path="/dataset" element={<DatasetScreen />} />

              {/* System Sub-screens */}
              <Route path="/machine" element={<MachineScreen />} />
              <Route path="/api-status" element={<ApiScreen />} />
              <Route path="/checker" element={<CheckerScreen />} />
              <Route path="/models" element={<ModelsScreen />} />
              <Route path="/compare" element={<CompareScreen />} />

              {/* Narrative & Verification Screens */}
              <Route path="/investigate" element={<InvestigateScreen />} />
              <Route path="/causal" element={<CausalScreen />} />
              <Route path="/crash-test" element={<CrashTestScreen />} />
              <Route path="/similar" element={<SimilarScreen />} />

              {/* Signature Components Dev Showcase */}
              <Route path="/dev/components" element={<ComponentsDevScreen />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Global Auth Modal */}
          <AuthModal />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
