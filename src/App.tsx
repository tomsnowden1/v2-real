import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import BottomNav from './components/BottomNav';
import { seedDatabase } from './db/seed';
import { getUserProfile } from './db/userProfileService';
import { WorkoutProvider } from './context/WorkoutContext';
import GoalSelectionGuard from './components/GoalSelectionGuard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RestTimerProvider } from './context/RestTimerContext';
import GlobalRestTimer from './components/GlobalRestTimer';
import Spinner from './components/Spinner';
import InstallBanner from './components/InstallBanner';

// Route-level pages — loaded on demand
const Home = lazy(() => import('./pages/Home'));
const WorkoutLogger = lazy(() => import('./pages/WorkoutLogger'));
const History = lazy(() => import('./pages/History'));
const WorkoutDetail = lazy(() => import('./pages/WorkoutDetail'));
const Coach = lazy(() => import('./pages/Coach'));
const More = lazy(() => import('./pages/More'));
const ExerciseLibrary = lazy(() => import('./pages/ExerciseLibrary'));
const ExerciseDetails = lazy(() => import('./pages/ExerciseDetails'));
const Templates = lazy(() => import('./pages/Templates'));
const TemplateDetail = lazy(() => import('./pages/TemplateDetail'));
const GymProfiles = lazy(() => import('./pages/GymProfiles'));
const GymEquipment = lazy(() => import('./pages/GymEquipment'));
const AISettings = lazy(() => import('./pages/AISettings'));
const Records = lazy(() => import('./pages/Records'));
const Analytics = lazy(() => import('./pages/Analytics'));

function App() {
  const profile = useLiveQuery(() => getUserProfile().then(p => p || null));

  useEffect(() => {
    seedDatabase().catch(console.error);
  }, []);

  // Catch unhandled promise rejections (async errors outside React)
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const theme = profile?.theme || 'System';

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    if (theme === 'System') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      applyTheme(theme === 'Dark');
    }
  }, [profile?.theme]);

  return (
    <ErrorBoundary>
      <RestTimerProvider>
        <WorkoutProvider>
          <GoalSelectionGuard>
            <BrowserRouter>
              <div className="app-container">
                <main className="main-content">
                  <Suspense fallback={<Spinner size="lg" />}>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/workout" element={<WorkoutLogger />} />
                      <Route path="/history" element={<History />} />
                      <Route path="/history/:id" element={<WorkoutDetail />} />
                      <Route path="/coach" element={<Coach />} />
                      <Route path="/more" element={<More />} />
                      <Route path="/exercises" element={<ExerciseLibrary />} />
                      <Route path="/exercises/:id" element={<ExerciseDetails />} />
                      <Route path="/templates" element={<Templates />} />
                      <Route path="/templates/:id" element={<TemplateDetail />} />
                      <Route path="/gyms" element={<GymProfiles />} />
                      <Route path="/gyms/:gymId" element={<GymEquipment />} />
                      <Route path="/settings" element={<AISettings />} />
                      <Route path="/records" element={<Records />} />
                      <Route path="/analytics" element={<Analytics />} />
                    </Routes>
                  </Suspense>
                </main>
                <BottomNav />
                <GlobalRestTimer />
              </div>
            </BrowserRouter>
          </GoalSelectionGuard>
        </WorkoutProvider>
      </RestTimerProvider>
      <InstallBanner />
    </ErrorBoundary>
  );
}

export default App;
