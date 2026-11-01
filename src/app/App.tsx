import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProfileProvider, useProfile } from './profile';
import { HomePage } from '@/modules/home/HomePage';
import { ExplorerPage } from '@/modules/explorer/ExplorerPage';
import { SettingsPage } from '@/modules/settings/SettingsPage';
import { OnboardingPage } from '@/modules/onboarding/OnboardingPage';
import { MasteryPage } from '@/modules/fretboard-mastery/MasteryPage';
import { ToolsPage } from '@/modules/tools/ToolsPage';
import { unlockAudio } from '@/audio/engine';

function AppRoutes() {
  const { profile } = useProfile();
  if (profile === undefined) return <div className="min-h-dvh" aria-busy="true" />;
  const needsOnboarding = profile === null || !profile.onboarded;
  return (
    <Routes>
      {needsOnboarding ? (
        <>
          <Route path="/welcome" element={<OnboardingPage />} />
          <Route path="*" element={<Navigate to="/welcome" replace />} />
        </>
      ) : (
        <>
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/notes" element={<MasteryPage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
    </Routes>
  );
}

export function App() {
  return (
    // Any first touch anywhere unlocks audio (required on iOS).
    <div className="min-h-dvh font-sans" onPointerDownCapture={unlockAudio} onKeyDownCapture={unlockAudio}>
      <ProfileProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </ProfileProvider>
    </div>
  );
}
