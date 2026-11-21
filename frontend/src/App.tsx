import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { NewScreening } from "./pages/NewScreening";
import { Rankings } from "./pages/Rankings";
import { Processing } from "./pages/Processing";
import { CandidateProfile } from "./pages/CandidateProfile";
import { Comparison } from "./pages/Comparison";
import { Analytics } from "./pages/Analytics";
import { Jobs } from "./pages/Jobs";
import { Settings } from "./pages/Settings";
import { Help } from "./pages/Help";
import { NotFound } from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="screenings/new" element={<NewScreening />} />
        <Route path="screenings/:screeningId" element={<Rankings />} />
        <Route path="screenings/:screeningId/processing" element={<Processing />} />
        <Route path="screenings/:screeningId/analytics" element={<Analytics />} />
        <Route path="screenings/:screeningId/compare" element={<Comparison />} />
        <Route path="candidates/:candidateId" element={<CandidateProfile />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
        <Route path="help" element={<Help />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
