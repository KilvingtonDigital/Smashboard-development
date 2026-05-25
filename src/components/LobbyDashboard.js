import React, { useState, useEffect } from 'react';

const LobbyDashboard = ({ tournamentId }) => {
  const [tournament, setTournament] = useState(null);
  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchLobbyData = async () => {
      try {
        const response = await fetch(`${API_URL}/api/public/tournament/${tournamentId}/lobby`);
        if (!response.ok) {
          throw new Error('Tournament session not found or inactive');
        }
        const data = await response.json();
        setTournament(data.tournament);
        setPlayers(data.players || []);
        setStatus('ready');
      } catch (err) {
        console.error(err);
        setErrorMsg(err.message);
        setStatus('error');
      }
    };

    fetchLobbyData();
    // Auto-poll every 3 seconds to animate transitions in real-time
    const interval = setInterval(fetchLobbyData, 3000);
    return () => clearInterval(interval);
  }, [tournamentId, API_URL]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-primary p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-secondary"></div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-primary p-4 text-center">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-soft">
          <div className="text-4xl mb-4">📺</div>
          <h2 className="text-xl font-bold text-white mb-2">Lobby Offline</h2>
          <p className="text-white/60 text-sm mb-6">{errorMsg}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-brand-secondary text-brand-primary font-bold py-3 px-4 rounded-xl hover:bg-brand-secondary/90 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const checkedInCount = players.filter(p => p.present).length;
  const totalCount = players.length;
  const progressPercent = totalCount > 0 ? Math.round((checkedInCount / totalCount) * 100) : 0;

  // Contactless check-in URL pointing to mobile register/checkin portal
  // In development, uses registrationSlug fallback or placeholder
  const checkinUrl = `https://dinksync.app/join/slug/${tournamentId}?checkin=true`;
  const qrCodeImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(checkinUrl)}`;

  return (
    <div className="min-h-screen bg-brand-primary font-sans text-white p-6 sm:p-8 flex flex-col justify-between overflow-x-hidden">
      
      {/* 1. Header Section */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-6 mb-8 gap-4">
        <div className="flex items-center space-x-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-secondary text-brand-primary font-black text-lg tracking-tighter">
            DS
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest bg-brand-secondary/20 text-brand-secondary px-2.5 py-0.5 rounded-full border border-brand-secondary/35">
                LIVE CHECK-IN
              </span>
              {tournament?.isActive && (
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
              {tournament?.name || 'Active Session'}
            </h1>
          </div>
        </div>

        {/* Checked In Progress Ticker */}
        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center space-x-4 min-w-[240px] shadow-lg shadow-black/20">
          <div className="flex-1">
            <div className="flex justify-between text-xs font-semibold mb-1 text-white/70">
              <span>Roster Attendance</span>
              <span className="text-brand-secondary">{progressPercent}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-brand-secondary rounded-full transition-all duration-1000 ease-out shadow-[0_0_12px_#d6f060]"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black tracking-tight text-brand-secondary">
              {checkedInCount}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-white/40 mt-0.5">
              of {totalCount} In
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Dashboard Split */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch mb-8">
        
        {/* Left Card: QR check-in details */}
        <section className="lg:col-span-1 flex flex-col justify-center items-center bg-white/5 border border-white/10 rounded-3xl p-8 text-center shadow-lg shadow-black/20">
          <div className="bg-white p-4 rounded-2xl shadow-xl shadow-black/40 border-4 border-brand-secondary">
            <img 
              src={qrCodeImageSrc} 
              alt="Scan to check in" 
              className="w-48 h-48 sm:w-56 sm:h-56"
            />
          </div>
          <h3 className="text-lg font-black mt-6 leading-snug">
            Contactless Check-In
          </h3>
          <p className="text-sm font-semibold text-white/50 mt-2 max-w-[240px] leading-relaxed">
            Scan this QR code with your phone to sign in and activate your bracket profile instantly.
          </p>
        </section>

        {/* Right Card: Alphabetical Player Attendance Board */}
        <section className="lg:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col shadow-lg shadow-black/20">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-bold tracking-wide uppercase text-white/50">
              Player Registry Directory
            </h3>
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              Alphabetical (A–Z)
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[50vh] pr-2 scrollbar-thin">
            {players.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center py-12 text-white/40 text-sm">
                No players added to the session yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {players.map((player) => (
                  <div 
                    key={player.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-500 ${
                      player.present 
                        ? 'bg-brand-secondary/10 border-brand-secondary/40 text-white shadow-[0_2px_15px_rgba(214,240,96,0.06)]' 
                        : 'bg-white/5 border-white/5 text-white/50'
                    }`}
                  >
                    <div className="flex items-center space-x-3 truncate">
                      <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 transition-all duration-500 ${
                        player.present 
                          ? 'bg-brand-secondary shadow-[0_0_8px_#d6f060]' 
                          : 'bg-red-500 animate-pulse'
                      }`}></span>
                      <span className="font-semibold text-sm truncate">{player.name}</span>
                    </div>

                    <div className={`h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-black uppercase ${
                      player.present 
                        ? 'bg-brand-secondary text-brand-primary' 
                        : 'bg-white/5 text-white/20'
                    }`}>
                      {player.present ? '✓' : '-'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* 3. Footer */}
      <footer className="border-t border-white/10 pt-6 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-white/40 gap-4">
        <div>
          Powered by <strong className="text-white/60 font-semibold">DinkSync</strong> – Contactless Tournament Management Engine.
        </div>
        <div className="flex items-center space-x-2.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          <span>Lobby Feed Connected</span>
        </div>
      </footer>

    </div>
  );
};

export default LobbyDashboard;
