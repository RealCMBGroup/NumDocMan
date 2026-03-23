import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './i18n';
import './App.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';

const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const ProjectsPage = React.lazy(() => import('./pages/ProjectsPage'));
const ProjectDetailPage = React.lazy(() => import('./pages/ProjectDetailPage'));
const DocumentsPage = React.lazy(() => import('./pages/DocumentsPage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const AuthCallback = React.lazy(() => import('./pages/AuthCallback'));

type ProtectedRouteProps = {
  children: React.ReactNode;
};

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground font-ibm">NumDocMan...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground font-ibm">Chargement...</p>
      </div>
    </div>
  );
}

function AppRouter() {
  const location = useLocation();
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  if (location.hash?.includes('session_id=')) {
    return (
      <Suspense fallback={<AppLoader />}>
        <AuthCallback />
      </Suspense>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Suspense fallback={<AppLoader />}><LoginPage /></Suspense>} />
      <Route path="/dashboard" element={<ProtectedRoute><Suspense fallback={<AppLoader />}><DashboardPage /></Suspense></ProtectedRoute>} />
      <Route path="/projects" element={<ProtectedRoute><Suspense fallback={<AppLoader />}><ProjectsPage /></Suspense></ProtectedRoute>} />
      <Route path="/projects/:projectId" element={<ProtectedRoute><Suspense fallback={<AppLoader />}><ProjectDetailPage /></Suspense></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><Suspense fallback={<AppLoader />}><DocumentsPage /></Suspense></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><Suspense fallback={<AppLoader />}><AdminPage /></Suspense></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Suspense fallback={<AppLoader />}><SettingsPage /></Suspense></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
