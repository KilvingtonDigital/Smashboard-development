import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import PickleballTournamentManager from './PickleballTournamentManager';
import AuthPage from './components/AuthPage';
import MigrationPrompt from './components/MigrationPrompt';
import PublicRegistration from './components/PublicRegistration';
import LegalWaiver from './pages/LegalWaiver';
import TermsOfService from './pages/TermsOfService';

import ResetPassword from './components/ResetPassword';
import ErrorBoundary from './components/ErrorBoundary';
import SpectatorBracket from './pages/SpectatorBracket';
import SpectatorTvBracket from './pages/SpectatorTvBracket';

function AppContent() {
  const { isAuthenticated, loading, user, logout } = useAuth();

  // Check if we are on the reset password route
  const path = window.location.pathname;
  if (path.startsWith('/reset-password/')) {
    const token = path.split('/reset-password/')[1];
    if (token) {
      return <ResetPassword token={token} onResetSuccess={() => window.location.href = '/'} />;
    }
  }

  if (path === '/waiver') { return <LegalWaiver />; }
  if (path === '/terms') { return <TermsOfService />; }

  // Check if we are on the public registration route
  if (path.startsWith('/join/')) {
    const slug = path.split('/join/')[1];
    if (slug) {
      return <PublicRegistration slug={slug} />;
    }
  }

  // Check if we are on the spectator bracket route
  if (path.startsWith('/spectate/')) {
    let slug = path.split('/spectate/')[1];
    if (slug) {
      if (slug.endsWith('/tv')) {
        slug = slug.substring(0, slug.length - 3);
        return <SpectatorTvBracket slug={slug} />;
      }
      return <SpectatorBracket slug={slug} />;
    }
  }

  // Backdoor recovery route
  if (path === '/recovery') {
    localStorage.removeItem('pb_session');
    localStorage.removeItem('pb_roster');
    localStorage.removeItem('migration_completed');
    localStorage.removeItem('token');
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-dark-gray p-6 rounded-xl border border-lime text-center max-w-sm w-full">
          <div className="text-4xl mb-4">🧹</div>
          <h1 className="text-xl text-lime font-bold mb-4">Recovery Mode Initiated</h1>
          <p className="text-gray text-sm mb-6">All local session data and authentication tokens have been permanently purged. Your application state is completely clean.</p>
          <a href="/" className="inline-block w-full bg-lime text-black font-bold py-3 px-4 rounded-lg hover:bg-opacity-90 transition-colors">Return to Login</a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-lime text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <div>
      {/* Migration prompt for localStorage data */}
      <MigrationPrompt />

      {/* User info bar */}
      <div className="bg-dark-gray border-b border-gray px-4 py-2 flex justify-between items-center">
        <div className="text-white text-sm">
          Welcome, <span className="text-lime font-semibold">
            {user?.firstName && user?.lastName
              ? `${user.firstName} ${user.lastName}`
              : user?.username}
          </span>
        </div>
        <button
          onClick={logout}
          className="text-gray hover:text-lime text-sm transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Main app with Error Safeguard */}
      <ErrorBoundary>
        <PickleballTournamentManager />
      </ErrorBoundary>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
