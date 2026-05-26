import React, { useState, useEffect } from 'react';

const SpectatorTvBracket = ({ slug }) => {
  const [bracket, setBracket] = useState(null);
  const [orgName, setOrgName] = useState('');
  const [activeTournament, setActiveTournament] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'bracket' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [ticker, setTicker] = useState(0);

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

  useEffect(() => {
    fetchBracket();

    // 30-second auto-poll to refresh spectator data in the background
    const interval = setInterval(() => {
      fetchBracket(true);
    }, 30000);

    // 1-second clock interval for real-time TV digital clock rendering
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
      <div className="flex items-center justify-center min-h-screen bg-slate-950 p-4">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-secondary"></div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🏆</div>
          <h2 className="text-xl font-bold text-white mb-2">Spectate Link Invalid</h2>
          <p className="text-slate-400 mb-6 text-sm">{errorMsg}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-brand-secondary text-brand-primary font-black py-3 px-4 rounded-xl hover:bg-[#d6f060] transition-colors uppercase tracking-wider text-xs"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (status === 'no_active_tournament') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center py-12">
          <div className="text-6xl mb-4">🏓</div>
          <h2 className="text-2xl font-black text-white mb-2">No Active Bracket</h2>
          <p className="text-slate-400 mb-8 max-w-[280px] mx-auto text-sm">
            <strong>{orgName}</strong> is not running an active bracket tournament session at this moment.
          </p>
          <button 
            onClick={() => fetchBracket()}
            className="w-full bg-slate-800 text-white font-bold py-3 px-4 rounded-xl hover:bg-slate-700 transition-colors uppercase tracking-wider text-xs"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  const courtAssignments = bracket?.courtAssignments || [];
  const activeCourts = courtAssignments.filter(c => c.matchId);

  // Extract all matches
  const winnersMatches = bracket?.winnersMatches || [];
  const consolationMatches = bracket?.consolationMatches || [];
  const grandFinalsMatches = bracket?.grandFinalsMatches || [];
  const allMatches = [...winnersMatches, ...consolationMatches, ...grandFinalsMatches];

  // Determine standby matches (fully ready scheduled matches not on court)
  const activeMatchIds = activeCourts.map(c => c.matchId);
  const standbyMatches = allMatches.filter(match => {
    if (match.status !== 'scheduled') return false;
    if (!match.team1 || !match.team2) return false;
    if (match.team1.name === 'TBD' || match.team2.name === 'TBD') return false;
    if (match.team1.name === 'BYE' || match.team2.name === 'BYE') return false;
    return !activeMatchIds.includes(match.id);
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans p-6 overflow-hidden flex flex-col justify-between">
      
      {/* Sticky Fullscreen TV Header */}
      <div className="flex justify-between items-center bg-slate-900/60 border border-slate-800 rounded-3xl p-6 mb-6 select-none shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-brand-secondary text-brand-primary font-black text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full">
              TV QUEUE OVERLAY
            </span>
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-green-400 font-extrabold uppercase tracking-wider">Live Court Updates</span>
            {bracket?.delayMinutes > 0 && (
              <span className="bg-orange-500 text-white font-extrabold text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full animate-pulse ml-2">
                🌦️ WEATHER DELAY: +{bracket.delayMinutes}m
              </span>
            )}
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white leading-tight">
            {activeTournament?.tournament_name}
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Hosted by <span className="text-white font-bold">{orgName}</span>
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-3 px-5 flex items-center gap-6 text-sm font-bold select-none text-slate-300">
          <div className="text-center">
            <span className="text-[10px] text-slate-500 block leading-none mb-1">Skill Limit</span>
            <span className="capitalize">{activeTournament?.restricted_skill}</span>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div className="text-center">
            <span className="text-[10px] text-slate-500 block leading-none mb-1">Age group</span>
            <span className="capitalize">{activeTournament?.restricted_age}</span>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div className="text-center">
            <span className="text-[10px] text-slate-500 block leading-none mb-1">Gender</span>
            <span className="capitalize">{activeTournament?.restricted_gender === 'all' ? 'Open' : activeTournament?.restricted_gender}</span>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 h-full items-stretch">
        
        {/* Left Side: Massive Courts Grid */}
        <div className="lg:col-span-2 space-y-4 flex flex-col h-full">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest pl-1">
            🏟️ Court Assignments ({activeCourts.length} Courts Playing)
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            {courtAssignments.map(court => {
              const activeMatch = court.matchId ? allMatches.find(m => m.id === court.matchId) : null;
              const isOccupied = !!court.matchId;

              const elapsedSeconds = court.timerStart ? Math.floor((Date.now() - court.timerStart) / 1000) : 0;
              let timerLabel = '--:--';
              let timerClass = 'text-slate-500';

              if (court.timerMode === 'warmup') {
                const remaining = Math.max(0, 300 - elapsedSeconds);
                const m = Math.floor(remaining / 60).toString().padStart(2, '0');
                const s = (remaining % 60).toString().padStart(2, '0');
                timerLabel = `WARMUP: ${m}:${s}`;
                timerClass = remaining === 0 ? 'text-orange-500 animate-pulse font-black' : 'text-orange-400';
              } else if (court.timerMode === 'match') {
                const m = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
                const s = (elapsedSeconds % 60).toString().padStart(2, '0');
                timerLabel = `PLAY TIME: ${m}:${s}`;
                timerClass = elapsedSeconds > 900 ? 'text-red-500 animate-pulse font-black' : 'text-brand-secondary';
              }

              return (
                <div 
                  key={court.courtNumber} 
                  className={`rounded-3xl p-6 border flex flex-col justify-between transition-all min-h-[220px] shadow-lg
                    ${isOccupied 
                      ? 'border-brand-secondary bg-slate-900/60 shadow-[inset_0_4px_30px_rgba(214,240,96,0.03)]' 
                      : 'border-dashed border-slate-800 bg-slate-950/20 text-slate-600'}`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`text-xl font-black ${isOccupied ? 'text-white' : 'text-slate-600'}`}>Court {court.courtNumber}</span>
                    {isOccupied && (
                      <span className={`text-xs font-black uppercase tracking-wider ${timerClass}`}>
                        {timerLabel}
                      </span>
                    )}
                  </div>

                  {activeMatch ? (
                    <div className="space-y-3 flex-1 flex flex-col justify-center">
                      <div className="text-[10px] font-black text-brand-secondary uppercase tracking-widest">{activeMatch.id}</div>
                      <div className="text-2xl font-black tracking-tight text-white leading-snug">
                        {activeMatch.team1?.name}
                        <span className="text-slate-500 font-semibold block text-sm my-1 text-center">vs</span>
                        {activeMatch.team2?.name}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-4">
                      <span className="text-4xl mb-1 text-slate-800 opacity-60">🎾</span>
                      <span className="text-xs font-extrabold uppercase tracking-widest text-slate-700">COURT VACANT</span>
                    </div>
                  )}

                  {isOccupied && (
                    <div className="border-t border-slate-800/80 pt-3 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <span>Status: {court.status}</span>
                      <span>Referee Assigned</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: On Deck / Standby Queue Panel */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between min-h-[500px]">
          <div className="space-y-4 h-full flex flex-col">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center select-none">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">
                📋 Standby Match Queue
              </h2>
              <span className="text-[10px] bg-brand-secondary/20 text-brand-secondary font-black px-2 py-0.5 rounded">
                {standbyMatches.length} READY
              </span>
            </div>

            {/* Standby Carousel/List */}
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {standbyMatches.length > 0 ? (
                standbyMatches.slice(0, 5).map((match, idx) => (
                  <div 
                    key={match.id} 
                    className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 space-y-2.5 flex flex-col hover:border-brand-secondary/40 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{match.id}</span>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider
                        ${idx === 0 ? 'bg-green-500/20 text-green-400 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
                        {idx === 0 ? '★ UP NEXT' : 'ON DECK'}
                      </span>
                    </div>
                    <div className="text-sm font-black text-white truncate">{match.team1?.name}</div>
                    <div className="text-[9px] font-black text-slate-600 text-center uppercase tracking-widest leading-none my-0.2">vs</div>
                    <div className="text-sm font-black text-white truncate">{match.team2?.name}</div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center text-center text-slate-500 h-full p-4 select-none">
                  <span className="text-4xl mb-2">📋</span>
                  <span className="text-xs font-black uppercase tracking-wider">Queue Empty</span>
                  <p className="text-[10px] text-slate-600 mt-1 leading-normal max-w-[200px]">All ready matches are currently active on court or completed!</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/80 text-center select-none text-[10px] font-bold text-slate-600 uppercase tracking-widest">
            Powered by DinkSync
          </div>
        </div>

      </div>

      {/* Booked Event Sponsors & Vendors */}
      {bracket?.sponsors && bracket.sponsors.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 mt-6 font-sans text-center select-none">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-4">
            🤝 Event Sponsored & Supported By
          </span>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {bracket.sponsors.map(sponsor => (
              <div
                key={sponsor.id}
                className="bg-slate-950/60 border border-slate-800/60 px-4 py-2 rounded-xl flex items-center gap-2"
              >
                <span className="text-base">🏢</span>
                <div className="text-left">
                  <span className="text-xs font-black text-white block leading-none">{sponsor.name}</span>
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mt-0.5">{sponsor.tier}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default SpectatorTvBracket;
