import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import PickleballTournamentManager from './PickleballTournamentManager';
import AuthPage from './components/AuthPage';
import MigrationPrompt from './components/MigrationPrompt';
import PublicRegistration from './components/PublicRegistration';
import LegalWaiver from './pages/LegalWaiver';
import TermsOfService from './pages/TermsOfService';
import TournamentsDashboard from './components/TournamentsDashboard';

import ResetPassword from './components/ResetPassword';
import ErrorBoundary from './components/ErrorBoundary';
import LobbyDashboard from './components/LobbyDashboard';

function AppContent() {
  const { isAuthenticated, loading, user, logout } = useAuth();
  const [activeSession, setActiveSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const checkActiveSession = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setSessionLoading(false);
        return;
      }
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/session`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setActiveSession(data.session);
      }
    } catch (err) {
      console.error('Error fetching active session:', err);
    } finally {
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      checkActiveSession();
    } else {
      setActiveSession(null);
      setSessionLoading(false);
    }
  }, [isAuthenticated]);

  // Check if we are on specific paths
  const path = window.location.pathname;
  if (path.startsWith('/reset-password/')) {
    const token = path.split('/reset-password/')[1];
    if (token) {
      return <ResetPassword token={token} onResetSuccess={() => window.location.href = '/'} />;
    }
  }

  if (path === '/waiver') { return <LegalWaiver />; }
  if (path === '/terms') { return <TermsOfService />; }

  // Screencast TV Lobby Dashboard Check
  if (path.startsWith('/lobby/')) {
    const tournamentId = path.split('/lobby/')[1];
    if (tournamentId) {
      return <LobbyDashboard tournamentId={tournamentId} />;
    }
  }

  // Check if we are on the public registration route (supports optional tournamentId)
  if (path.startsWith('/join/')) {
    const parts = path.split('/join/')[1].split('/');
    const slug = parts[0];
    const tournamentId = parts[1]; // optional
    if (slug) {
      return <PublicRegistration slug={slug} tournamentId={tournamentId} />;
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

  if (loading || (isAuthenticated && sessionLoading)) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-lime text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  const handleReturnToDashboard = async () => {
    if (!window.confirm("Return to Dashboard? Your active tournament progress is securely saved.")) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/session`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setActiveSession(null);
    } catch (err) {
      console.error('Error clearing session:', err);
    }
  };

  return (
    <div>
      {/* Migration prompt for localStorage data */}
      <MigrationPrompt />

      {/* Organizer User Navigation Bar */}
      <div className="bg-dark-gray border-b border-gray px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="text-white text-sm">
            Welcome, <span className="text-lime font-semibold">
              {user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.username}
            </span>
          </div>
          {activeSession && (
            <button
              onClick={handleReturnToDashboard}
              className="text-xs font-bold text-gray-400 hover:text-lime border border-[#333] hover:border-lime/30 bg-[#161616] px-3 py-1 rounded-lg transition-all"
            >
              ← Return to Tournaments Dashboard
            </button>
          )}
        </div>
        <button
          onClick={logout}
          className="text-gray hover:text-lime text-sm transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Main App Content Router */}
      <ErrorBoundary>
        {activeSession ? (
          <PickleballTournamentManager />
        ) : (
          <TournamentsDashboard onActivateTournament={checkActiveSession} />
        )}
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
