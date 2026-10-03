import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Sidebar } from './components/common/Sidebar';
import { Header } from './components/common/Header';

import { InvestigateScreen } from './screens/InvestigateScreen';
import { RunGraphScreen } from './screens/RunGraphScreen';
import { LiveLabScreen } from './screens/LiveLabScreen';
import { FleetFixScreen } from './screens/FleetFixScreen';
import { CausalScreen } from './screens/CausalScreen';
import { CrashTestScreen } from './screens/CrashTestScreen';
import { SimilarScreen } from './screens/SimilarScreen';
import { IncidentsScreen } from './screens/IncidentsScreen';
import { OverviewScreen } from './screens/OverviewScreen';
import { AtlasScreen } from './screens/AtlasScreen';
import { DatasetScreen } from './screens/DatasetScreen';

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
          {/* Left fixed sidebar */}
          <Sidebar />

          {/* Main content area */}
          <div className="flex-1 ml-64 min-h-screen flex flex-col">
            <Header
              title="Black Box AI Flight Recorder"
              subtitle="Autonomous Causal Diagnosis & Regression Firewall"
            />
            <main className="flex-1 bg-zinc-950">
              <Routes>
                <Route path="/investigate" element={<InvestigateScreen />} />
                <Route path="/runs/:id" element={<RunGraphScreen />} />
                <Route path="/runs" element={<Navigate to="/runs/37452fc329e1498f" replace />} />
                <Route path="/lab" element={<LiveLabScreen />} />
                <Route path="/fleet" element={<FleetFixScreen />} />
                <Route path="/causal" element={<CausalScreen />} />
                <Route path="/crash-test" element={<CrashTestScreen />} />
                <Route path="/similar" element={<SimilarScreen />} />
                <Route path="/incidents" element={<IncidentsScreen />} />
                <Route path="/atlas" element={<AtlasScreen />} />
                <Route path="/dataset" element={<DatasetScreen />} />
                <Route path="/" element={<OverviewScreen />} />
              </Routes>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
