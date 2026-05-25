import React, { useState, useEffect } from 'react';
import BracketView from '../components/BracketView';

const SpectatorBracket = ({ slug }) => {
  const [bracket, setBracket] = useState(null);
  const [orgName, setOrgName] = useState('');
  const [activeTournament, setActiveTournament] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'bracket' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const fetchBracket = async (isSilent = false) => {
    try {
      if (!isSilent) setStatus('loading');
      
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/public/bracket/${slug}`);
      if (!response.ok) {
        throw new Error('Spectator link invalid or expired.');
      }
      
      const data = await response.json();
      setOrgName(data.orgName);
      
      if (data.activeTournament) {
        setActiveTournament(data.activeTournament);
        setBracket(data.activeTournament.bracket);
        setStatus('bracket');
      } else {
        setStatus('no_active_tournament');
      }
    } catch (err) {
      if (!isSilent) {
        setStatus('error');
        setErrorMsg(err.message);
      }
    }
  };

  const [ticker, setTicker] = useState(0);

  useEffect(() => {
    fetchBracket();

    // 30-second auto-poll to refresh spectated brackets dynamically
    const interval = setInterval(() => {
      fetchBracket(true);
    }, 30000);

    // 1-second ticker interval for live countdown clocks on spectator phones
    const clockInterval = setInterval(() => {
      setTicker(t => t + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
    };
  }, [slug]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-light p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-secondary"></div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-light p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-soft text-center border border-brand-gray/30">
          <div className="text-4xl mb-4">🏆</div>
          <h2 className="text-xl font-bold text-brand-primary mb-2">Spectate Link Invalid</h2>
          <p className="text-brand-primary/70 mb-6 text-sm">{errorMsg}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-brand-secondary text-brand-primary font-bold py-3 px-4 rounded-xl hover:bg-brand-secondary/90 transition-colors uppercase tracking-wider text-xs"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (status === 'no_active_tournament') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-light p-4 font-sans">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-soft text-center border border-brand-gray/30 py-12">
          <div className="text-5xl mb-4">🏓</div>
          <h2 className="text-2xl font-black text-brand-primary mb-2">No Active Bracket</h2>
          <p className="text-brand-primary/60 mb-8 max-w-[280px] mx-auto text-sm">
            <strong>{orgName}</strong> is not running an active bracket tournament session at this moment.
          </p>
          <button 
            onClick={() => fetchBracket()}
            className="w-full bg-brand-secondary/20 text-brand-primary font-bold py-3 px-4 rounded-xl hover:bg-brand-secondary/30 transition-colors uppercase tracking-wider text-xs"
          >
            Check Standings Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-light font-sans py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-7xl">
        
        {/* Sticky-like header for Spectators */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white border border-brand-gray/80 shadow-[0_4px_25px_rgb(0,0,0,0.01)] rounded-3xl p-5 mb-6 gap-4">
          <div className="text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <span className="bg-brand-secondary/30 text-brand-primary font-extrabold text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                Spectator Portal
              </span>
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Live standings</span>
            </div>
            <h1 className="text-xl font-black text-brand-primary">
              {activeTournament?.tournament_name}
            </h1>
            <p className="text-xs text-brand-primary/50 font-medium">
              Hosted by <span className="font-bold text-brand-primary">{orgName}</span>
            </p>
          </div>

          <div className="bg-brand-light border border-brand-gray/60 rounded-2xl py-2 px-4 flex items-center justify-center gap-4 text-xs font-semibold select-none">
            <div className="text-center">
              <span className="text-[10px] text-brand-primary/40 block leading-none mb-1">Skill Limit</span>
              <span className="capitalize">{activeTournament?.restricted_skill}</span>
            </div>
            <div className="h-6 w-px bg-brand-gray/80" />
            <div className="text-center">
              <span className="text-[10px] text-brand-primary/40 block leading-none mb-1">Age group</span>
              <span className="capitalize">{activeTournament?.restricted_age}</span>
            </div>
            <div className="h-6 w-px bg-brand-gray/80" />
            <div className="text-center">
              <span className="text-[10px] text-brand-primary/40 block leading-none mb-1">Gender</span>
              <span className="capitalize">{activeTournament?.restricted_gender === 'all' ? 'Open' : activeTournament?.restricted_gender}</span>
            </div>
          </div>
        </div>

        {/* 🏟️ Live Court Assignments for Spectators */}
        {bracket?.courtAssignments && bracket.courtAssignments.some(c => c.matchId) && (
          <div className="bg-white border border-brand-gray/80 shadow-[0_4px_25px_rgb(0,0,0,0.01)] rounded-3xl p-5 mb-6 font-sans select-none animate-fade-in">
            <h3 className="text-xs font-black text-brand-primary/50 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              🏟️ Active Court Assignments
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {bracket.courtAssignments.map(court => {
                if (!court.matchId) return null;
                
                // Find match details
                const allMatches = [
                  ...(bracket.winnersMatches || []),
                  ...(bracket.consolationMatches || []),
                  ...(bracket.grandFinalsMatches || [])
                ];
                const match = allMatches.find(m => m.id === court.matchId);
                if (!match) return null;

                const elapsedSeconds = court.timerStart ? Math.floor((Date.now() - court.timerStart) / 1000) : 0;
                let timerLabel = '';
                let timerClass = 'bg-gray-100 text-gray-500';

                if (court.timerMode === 'warmup') {
                  const remaining = Math.max(0, 300 - elapsedSeconds);
                  const m = Math.floor(remaining / 60).toString().padStart(2, '0');
                  const s = (remaining % 60).toString().padStart(2, '0');
                  timerLabel = `⏱️ Warmup: ${m}:${s}`;
                  timerClass = remaining === 0 ? 'bg-orange-500/20 text-orange-600 animate-pulse' : 'bg-orange-100 text-orange-500';
                } else if (court.timerMode === 'match') {
                  const m = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
                  const s = (elapsedSeconds % 60).toString().padStart(2, '0');
                  timerLabel = `🎾 Play: ${m}:${s}`;
                  timerClass = elapsedSeconds > 900 ? 'bg-red-500/20 text-red-600 animate-pulse' : 'bg-green-500/20 text-green-600';
                }

                return (
                  <div key={court.courtNumber} className="border border-brand-gray/80 rounded-2xl p-3.5 space-y-2.5 bg-brand-light/20">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-black text-brand-primary">Court {court.courtNumber}</span>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${timerClass}`}>
                        {timerLabel || court.status}
                      </span>
                    </div>
                    <div className="text-[10px] font-black text-brand-primary/40 uppercase tracking-widest">{court.matchId}</div>
                    <div className="text-xs font-bold text-brand-primary truncate">
                      {match.team1?.name} <span className="opacity-40 font-semibold block text-[10px] my-0.2 text-center">vs</span> {match.team2?.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Read-Only Bracket View */}
        <BracketView 
          bracket={bracket} 
          onMatchScore={() => {}} 
          readOnly={true} 
        />

        <div className="mt-8 text-center">
          <a href="https://dinksync.com" target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-primary/30 hover:text-brand-primary/50 transition-colors uppercase tracking-widest font-semibold">
            Powered by DinkSync
          </a>
        </div>
      </div>
    </div>
  );
};

export default SpectatorBracket;
