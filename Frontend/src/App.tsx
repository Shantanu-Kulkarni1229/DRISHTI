import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { SearchPage } from './pages/search/SearchPage';
import { ChangeAnalysisPage } from './pages/change/ChangeAnalysisPage';
import { SiteTimelinePage } from './pages/timeline/SiteTimelinePage';
import { DiscoveryPage } from './pages/discovery/DiscoveryPage';
import { ReviewQueuePage } from './pages/review/ReviewQueuePage';
import { EvidencePage } from './pages/evidence/EvidencePage';
import { DataManagerPage } from './pages/data/DataManagerPage';
import { EvaluationPage } from './pages/evaluation/EvaluationPage';
import { ExportAuditPage } from './pages/export/ExportAuditPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/search" replace />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/change" element={<ChangeAnalysisPage />} />
          <Route path="/timeline" element={<SiteTimelinePage />} />
          <Route path="/discovery" element={<DiscoveryPage />} />
          <Route path="/review" element={<ReviewQueuePage />} />
          <Route path="/evidence" element={<EvidencePage />} />
          <Route path="/evidence/:candidateId" element={<EvidencePage />} />
          <Route path="/data" element={<DataManagerPage />} />
          <Route path="/evaluation" element={<EvaluationPage />} />
          <Route path="/export" element={<ExportAuditPage />} />
          <Route path="*" element={<Navigate to="/search" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
