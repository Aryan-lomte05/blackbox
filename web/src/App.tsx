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
const IncidentsStub = () => <div className="p-8 text-zinc-400 font-mono">Guardian Incidents screen building next...</div>;
const OverviewStub = () => <div className="p-8 text-zinc-400 font-mono">Overview screen building next...</div>;
const AtlasStub = () => <div className="p-8 text-zinc-400 font-mono">Atlas screen building next...</div>;
const DatasetStub = () => <div className="p-8 text-zinc-400 font-mono">Dataset screen building next...</div>;

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
                <Route path="/incidents" element={<IncidentsStub />} />
                <Route path="/atlas" element={<AtlasStub />} />
                <Route path="/dataset" element={<DatasetStub />} />
                <Route path="/" element={<InvestigateScreen />} />
              </Routes>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
