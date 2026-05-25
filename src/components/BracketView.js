import React, { useState, useEffect } from 'react';

export default function BracketView({ bracket, onMatchScore, readOnly = false, onUpdateBracket = null, players = [] }) {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [activeTab, setActiveTab] = useState('winners'); // 'winners' | 'consolation' | 'grand_finals'
  
  // Custom toast notification system
  const [toast, setToast] = useState(null);
  const triggerToast = (message) => {
    setToast(message);
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Substitution state inside score modal
  const [isSubbing, setIsSubbing] = useState(false);
  const [subSide, setSubSide] = useState(1); // 1 = Team 1, 2 = Team 2
  const [subPlayerIdx, setSubPlayerIdx] = useState(0); // Index of partner to swap (0 or 1)
  const [selectedSubPlayerId, setSelectedSubPlayerId] = useState('');

  // 1-second ticker interval for real-time court clock rendering
  const [ticker, setTicker] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTicker(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!bracket || !bracket.winnersMatches || bracket.winnersMatches.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-brand-gray text-center max-w-md mx-auto my-8">
        <div className="text-4xl mb-3">🏆</div>
        <h3 className="text-lg font-bold text-brand-primary">No Bracket Generated</h3>
        <p className="text-xs text-brand-primary/70 mt-1">
          Check in players and pre-formed teams in the Roster tab first, then generate the bracket to begin.
        </p>
      </div>
    );
  }

  const { winnersMatches = [], consolationMatches = [], grandFinalsMatches = [], type, numRounds } = bracket;
  const allMatches = [...winnersMatches, ...consolationMatches, ...grandFinalsMatches];

  // 🏟️ ACTIVE COURT STATES
  const numCourts = bracket.courts || 4;
  const courtAssignments = bracket.courtAssignments || Array.from({ length: numCourts }, (_, i) => ({
    courtNumber: i + 1,
    matchId: null,
    status: 'available', // 'available' | 'warming_up' | 'playing'
    timerStart: null,
    timerMode: null
  }));

  const updateCourts = (newCourts) => {
    if (onUpdateBracket) {
      onUpdateBracket({
        ...bracket,
        courtAssignments: newCourts
      });
    }
  };

  // 🥇 PODIUM CALCULATIONS
  const getPodiumWinners = () => {
    let gold = null;
    let silver = null;
    let bronze = null;

    if (type === 'double_elim') {
      const gf1 = grandFinalsMatches[0];
      const gf2 = grandFinalsMatches[1];
      
      if (gf2 && gf2.status === 'completed') {
        gold = gf2.winner === 'team1' ? gf2.team1 : gf2.team2;
        silver = gf2.winner === 'team1' ? gf2.team2 : gf2.team1;
      } else if (gf1 && gf1.status === 'completed') {
        gold = gf1.winner === 'team1' ? gf1.team1 : gf1.team2;
        silver = gf1.winner === 'team1' ? gf1.team2 : gf1.team1;
      }
      
      const consFinals = consolationMatches.find(m => m.round === totalConsolationRounds);
      if (consFinals && consFinals.status === 'completed') {
        bronze = consFinals.winner === 'team1' ? consFinals.team1 : consFinals.team2;
      }
    } else {
      const champMatch = winnersMatches.find(m => m.round === numRounds);
      if (champMatch && champMatch.status === 'completed') {
        gold = champMatch.winner === 'team1' ? champMatch.team1 : champMatch.team2;
        silver = champMatch.winner === 'team1' ? champMatch.team2 : champMatch.team1;
      }
      
      const bronzeMatch = consolationMatches[0];
      if (bronzeMatch && bronzeMatch.status === 'completed') {
        bronze = bronzeMatch.winner === 'team1' ? bronzeMatch.team1 : bronzeMatch.team2;
      }
    }

    return { gold, silver, bronze };
  };

  // 🖼️ AWARD CERTIFICATE CANVAS GENERATOR
  const downloadAwardGraphic = (playerNames, placementLabel) => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 800, 600);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);

    ctx.strokeStyle = '#d6f060';
    ctx.lineWidth = 12;
    ctx.strokeRect(20, 20, 760, 560);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 2;
    ctx.strokeRect(35, 35, 730, 530);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 SMASHBOARD CHAMPIONSHIP 🏆', 400, 100);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('OFFICIAL TOURNAMENT AWARD', 400, 140);

    ctx.fillStyle = '#d6f060';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText(placementLabel.toUpperCase(), 400, 240);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px sans-serif';
    ctx.fillText(playerNames, 400, 340);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Presented on ${new Date().toLocaleDateString()} for outstanding competitive performance`, 400, 410);
    ctx.fillText(`in the ${bracket.tournamentName || 'SmashBoard Event'} brackets.`, 400, 435);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = 'italic 14px sans-serif';
    ctx.fillText('Certified by DinkSync', 400, 510);

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `smashboard_award_${placementLabel.toLowerCase().replace(/\s+/g, '_')}.png`;
    a.click();
  };

  // 📊 DUPR MATCH RESULTS CSV ENGINE
  const exportDuprCsv = () => {
    const headers = [
      'Match ID', 'Event Name', 'Date',
      'Team 1 Player A Name', 'Team 1 Player A DUPR ID', 'Team 1 Player B Name', 'Team 1 Player B DUPR ID',
      'Team 2 Player A Name', 'Team 2 Player A DUPR ID', 'Team 2 Player B Name', 'Team 2 Player B DUPR ID',
      'Team 1 Score 1', 'Team 2 Score 1', 'Winner'
    ];
    
    const rows = [headers];
    
    allMatches.forEach(match => {
      if (match.status !== 'completed') return;
      
      const t1Names = match.team1?.name?.split(' / ') || [];
      const t2Names = match.team2?.name?.split(' / ') || [];
      
      const getDuprId = (name) => {
        if (!name) return '';
        const found = (players || []).find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
        return found?.duprId || found?.dupr_id || '';
      };
      
      const p1A_Name = t1Names[0] || '';
      const p1A_Dupr = getDuprId(p1A_Name);
      const p1B_Name = t1Names[1] || '';
      const p1B_Dupr = getDuprId(p1B_Name);
      
      const p2A_Name = t2Names[0] || '';
      const p2A_Dupr = getDuprId(p2A_Name);
      const p2B_Name = t2Names[1] || '';
      const p2B_Dupr = getDuprId(p2B_Name);
      
      const winnerLabel = match.winner === 'team1' ? 'Team 1' : 'Team 2';
      
      const row = [
        match.id,
        bracket.tournamentName || 'Tournament',
        new Date().toLocaleDateString(),
        p1A_Name, p1A_Dupr, p1B_Name, p1B_Dupr,
        p2A_Name, p2A_Dupr, p2B_Name, p2B_Dupr,
        match.score1 || 0, match.score2 || 0,
        winnerLabel
      ];
      
      rows.push(row);
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + rows.map(e => e.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `smashboard_dupr_matches_${bracket.tournamentName?.toLowerCase().replace(/\s+/g, '_') || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    triggerToast("DUPR Matches CSV generated & downloaded!");
  };

  // 📊 TELEMETRY CALCULATIONS
  const completedWinners = winnersMatches.filter(m => m.status === 'completed');
  const completedConsolation = consolationMatches.filter(m => m.status === 'completed');
  const completedGF = grandFinalsMatches.filter(m => m.status === 'completed');
  const allCompleted = [...completedWinners, ...completedConsolation, ...completedGF];
  
  const totalCompleted = allCompleted.length;
  
  const remainingWinners = winnersMatches.filter(m => m.status === 'scheduled').length;
  const remainingConsolation = consolationMatches.filter(m => m.status === 'scheduled').length;
  const remainingGF = grandFinalsMatches.filter(m => m.status === 'scheduled').length;
  const totalRemaining = remainingWinners + remainingConsolation + remainingGF;
  
  const courtsAvailable = numCourts;
  const avgMatchDuration = 15; // 15 mins average
  const estRoundsLeft = Math.ceil(totalRemaining / courtsAvailable);
  const estMinutesLeft = estRoundsLeft * avgMatchDuration;

  // 📋 STANDBY MATCH QUEUE CALCULATIONS (Unassigned, fully decided matches, no double-booked players)
  const activeMatchIds = courtAssignments.filter(c => c.matchId).map(c => c.matchId);
  const activeCourtPlayers = new Set();
  activeMatchIds.forEach(mId => {
    const m = allMatches.find(x => x.id === mId);
    if (m) {
      m.team1?.name?.split(' / ').forEach(p => activeCourtPlayers.add(p.trim()));
      m.team2?.name?.split(' / ').forEach(p => activeCourtPlayers.add(p.trim()));
    }
  });

  const standbyMatches = allMatches.filter(match => {
    if (match.status !== 'scheduled') return false;
    if (!match.team1 || !match.team2) return false;
    if (match.team1.name === 'TBD' || match.team2.name === 'TBD') return false;
    if (match.team1.name === 'BYE' || match.team2.name === 'BYE') return false;
    if (activeMatchIds.includes(match.id)) return false;

    // Check for double booking
    const mPlayers = [];
    match.team1.name?.split(' / ').forEach(p => mPlayers.push(p.trim()));
    match.team2.name?.split(' / ').forEach(p => mPlayers.push(p.trim()));
    return !mPlayers.some(p => activeCourtPlayers.has(p));
  });

  // Group matches by round
  const winnersByRound = {};
  for (let r = 1; r <= numRounds; r++) {
    winnersByRound[r] = winnersMatches.filter(m => m.round === r);
  }

  const consolationByRound = {};
  const totalConsolationRounds = (numRounds - 1) * 2;
  if (type === 'double_elim' && consolationMatches.length > 0) {
    for (let r = 1; r <= totalConsolationRounds; r++) {
      consolationByRound[r] = consolationMatches.filter(m => m.round === r);
    }
  }

  // 🎛️ DRAG-AND-DROP & ASSIGNMENT UTILITIES
  const handleDragStart = (e, matchId) => {
    e.dataTransfer.setData('text/plain', matchId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, courtNumber) => {
    e.preventDefault();
    const matchId = e.dataTransfer.getData('text/plain');
    if (matchId) {
      assignMatchToCourt(matchId, courtNumber);
    }
  };

  const assignMatchToCourt = (matchId, courtNumber) => {
    const updated = [...courtAssignments];
    const idx = updated.findIndex(c => c.courtNumber === courtNumber);
    if (idx === -1) return;

    if (updated[idx].matchId) {
      triggerToast(`Court ${courtNumber} is already occupied.`);
      return;
    }
    if (updated.some(c => c.matchId === matchId)) {
      triggerToast(`Match ${matchId} is already on another court.`);
      return;
    }

    updated[idx] = {
      courtNumber,
      matchId,
      status: 'warming_up',
      timerStart: Date.now(),
      timerMode: 'warmup'
    };

    updateCourts(updated);
    triggerToast(`Match ${matchId} assigned to Court ${courtNumber}!`);
  };

  const startMatchPlay = (courtNumber) => {
    const updated = [...courtAssignments];
    const idx = updated.findIndex(c => c.courtNumber === courtNumber);
    if (idx !== -1) {
      updated[idx] = {
        ...updated[idx],
        status: 'playing',
        timerStart: Date.now(),
        timerMode: 'match'
      };
      updateCourts(updated);
      triggerToast(`Warmup complete! Match is now active on Court ${courtNumber}.`);
    }
  };

  const releaseCourt = (courtNumber) => {
    const updated = [...courtAssignments];
    const idx = updated.findIndex(c => c.courtNumber === courtNumber);
    if (idx !== -1) {
      const oldMatchId = updated[idx].matchId;
      updated[idx] = {
        courtNumber,
        matchId: null,
        status: 'available',
        timerStart: null,
        timerMode: null
      };
      updateCourts(updated);
      triggerToast(`Match ${oldMatchId} removed from Court ${courtNumber}.`);
    }
  };

  const pingPlayersForMatch = (matchId, courtNumber) => {
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;

    const names = `${match.team1?.name} vs ${match.team2?.name}`;
    const msg = `📢 Call to Court: ${names} please report to Court ${courtNumber} immediately!`;

    fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/notifications/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, courtNumber, msg })
    }).catch(() => {});

    triggerToast(msg);
  };

  // Substitutions
  const standbyRoster = (players || []).filter(p => {
    if (!p.checkedIn) return false;
    if (activeCourtPlayers.has(p.name)) return false;
    return true;
  });

  const confirmPlayerSwap = (e) => {
    e.preventDefault();
    if (!selectedMatch || !selectedSubPlayerId) return;

    const targetSubPlayer = players.find(p => p.id === selectedSubPlayerId);
    if (!targetSubPlayer) return;

    const updatedBracket = JSON.parse(JSON.stringify(bracket));
    const targetMatch = [...updatedBracket.winnersMatches, ...updatedBracket.consolationMatches, ...updatedBracket.grandFinalsMatches]
      .find(m => m.id === selectedMatch.id);
    
    if (targetMatch) {
      const team = subSide === 1 ? targetMatch.team1 : targetMatch.team2;
      if (team) {
        let names = team.name.split(' / ');
        const oldName = names[subPlayerIdx] || 'Standby';
        names[subPlayerIdx] = targetSubPlayer.name;
        team.name = names.join(' / ');
        
        // Save and sync
        if (onUpdateBracket) {
          onUpdateBracket(updatedBracket);
        }
        triggerToast(`Swapped ${oldName} with ${targetSubPlayer.name} in match ${selectedMatch.id}!`);
      }
    }

    setIsSubbing(false);
    setSelectedMatch(null);
  };

  const openScoreModal = (match) => {
    if (readOnly) return; 
    if (match.status === 'bye' || match.status === 'skipped') return;
    setSelectedMatch(match);
    setScore1(match.score1 || '');
    setScore2(match.score2 || '');
    setIsSubbing(false);
  };

  const handleSaveScore = (e) => {
    e.preventDefault();
    if (!selectedMatch) return;

    const s1 = parseInt(score1);
    const s2 = parseInt(score2);

    if (isNaN(s1) || isNaN(s2)) {
      alert('Please enter valid numeric scores for both sides.');
      return;
    }
    if (s1 === s2) {
      alert('Ties are not allowed in elimination brackets. One side must win.');
      return;
    }

    // Auto-clear from court assignments upon score completion
    const updated = [...courtAssignments];
    const idx = updated.findIndex(c => c.matchId === selectedMatch.id);
    if (idx !== -1) {
      updated[idx] = {
        courtNumber: updated[idx].courtNumber,
        matchId: null,
        status: 'available',
        timerStart: null,
        timerMode: null
      };
      updateCourts(updated);
    }

    const winnerSide = s1 > s2 ? 1 : 2;
    onMatchScore(selectedMatch.id, winnerSide, { score1: s1, score2: s2 });
    setSelectedMatch(null);
  };

  const renderCourtTimer = (court) => {
    if (!court.timerStart) return null;
    const elapsedSeconds = Math.floor((Date.now() - court.timerStart) / 1000);
    
    if (court.timerMode === 'warmup') {
      const remaining = Math.max(0, 300 - elapsedSeconds); // 5 mins
      const m = Math.floor(remaining / 60).toString().padStart(2, '0');
      const s = (remaining % 60).toString().padStart(2, '0');
      const expired = remaining === 0;
      return (
        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${expired ? 'bg-orange-500/20 text-orange-600 animate-pulse' : 'bg-brand-gray text-brand-primary'}`}>
          ⏱️ Warmup: {m}:{s} {expired && "(Start Play!)"}
        </span>
      );
    } else {
      const m = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
      const s = (elapsedSeconds % 60).toString().padStart(2, '0');
      const overtime = elapsedSeconds > 900; // 15 mins
      return (
        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${overtime ? 'bg-red-500/20 text-red-600 animate-pulse' : 'bg-green-500/20 text-green-600'}`}>
          🎾 Play: {m}:{s} {overtime && "(Overtime)"}
        </span>
      );
    }
  };

  const renderMatchCard = (match) => {
    const isCompleted = match.status === 'completed';
    const isBye = match.status === 'bye';

    const t1Name = match.team1 ? match.team1.name : (isBye ? 'BYE' : 'TBD');
    const t2Name = match.team2 ? match.team2.name : (isBye ? 'BYE' : 'TBD');

    const t1Seed = match.team1?.seed ? `[${match.team1.seed}]` : '';
    const t2Seed = match.team2?.seed ? `[${match.team2.seed}]` : '';

    const isWinner1 = match.winner === 'team1';
    const isWinner2 = match.winner === 'team2';

    // Check if this match is assigned to a court
    const assignedCourt = courtAssignments.find(c => c.matchId === match.id);

    return (
      <div
        key={match.id}
        onClick={() => openScoreModal(match)}
        className={`w-52 bg-white rounded-2xl p-3 border shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all select-none relative
          ${isBye ? 'border-brand-secondary/30 bg-brand-secondary/5 opacity-80 cursor-default' : ''}
          ${!isBye && !readOnly ? 'border-brand-gray hover:border-brand-secondary hover:shadow-[0_8px_30px_rgba(214,240,96,0.15)] cursor-pointer hover:-translate-y-0.5' : 'border-brand-gray/80'}
          ${isCompleted ? 'bg-brand-light/50' : ''}`}
      >
        <div className="flex justify-between items-center text-[9px] font-bold text-brand-primary/40 uppercase tracking-widest mb-2">
          <span>{match.id}</span>
          {assignedCourt && (
            <span className="text-[9px] font-extrabold text-brand-secondary bg-brand-primary px-1.5 py-0.5 rounded-md uppercase tracking-wider">
              Ct {assignedCourt.courtNumber}
            </span>
          )}
          {isCompleted && <span className="text-green-600">✓ Completed</span>}
          {isBye && <span className="text-brand-primary/60">Bye</span>}
        </div>

        <div className="space-y-1.5">
          {/* Team 1 */}
          <div className="flex items-center justify-between text-xs min-h-[22px]">
            <span className={`font-semibold truncate max-w-[140px] ${isWinner1 ? 'text-green-700 font-extrabold' : 'text-brand-primary'} ${isWinner2 ? 'opacity-50' : ''}`}>
              <span className="text-[10px] text-brand-primary/30 mr-1">{t1Seed}</span> {t1Name}
            </span>
            {isCompleted && (
              <span className={`font-bold text-xs ${isWinner1 ? 'text-green-700 font-black bg-green-50 px-1.5 py-0.5 rounded' : 'opacity-40'}`}>
                {match.score1}
              </span>
            )}
          </div>

          <div className="border-t border-brand-gray/60" />

          {/* Team 2 */}
          <div className="flex items-center justify-between text-xs min-h-[22px]">
            <span className={`font-semibold truncate max-w-[140px] ${isWinner2 ? 'text-green-700 font-extrabold' : 'text-brand-primary'} ${isWinner1 ? 'opacity-50' : ''}`}>
              <span className="text-[10px] text-brand-primary/30 mr-1">{t2Seed}</span> {t2Name}
            </span>
            {isCompleted && (
              <span className={`font-bold text-xs ${isWinner2 ? 'text-green-700 font-black bg-green-50 px-1.5 py-0.5 rounded' : 'opacity-40'}`}>
                {match.score2}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-6 print:hidden">
      
      {/* 🔔 Gorgeous Host Toast Notifications */}
      {toast && (
        <div className="fixed top-4 right-4 z-[10000] bg-brand-primary border border-brand-secondary/40 text-white rounded-2xl p-4 shadow-xl max-w-sm flex items-center gap-3 animate-slide-in">
          <div className="text-xl">🔔</div>
          <div className="text-xs font-bold leading-normal">{toast}</div>
        </div>
      )}

      {/* 📊 Officiating Telemetry Panel (Organizers Only) */}
      {!readOnly && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-3xl border border-brand-gray/80 shadow-[0_4px_20px_rgb(0,0,0,0.01)] mb-6 select-none font-sans">
          <div className="text-center p-2 sm:border-r border-brand-gray/60 last:border-none">
            <span className="text-[9px] font-black text-brand-primary/40 uppercase tracking-widest block mb-0.5">Completed Matches</span>
            <span className="text-xl font-black text-brand-primary">{totalCompleted}</span>
          </div>
          <div className="text-center p-2 sm:border-r border-brand-gray/60 last:border-none">
            <span className="text-[9px] font-black text-brand-primary/40 uppercase tracking-widest block mb-0.5">Remaining Matches</span>
            <span className="text-xl font-black text-brand-primary">{totalRemaining}</span>
          </div>
          <div className="text-center p-2 sm:border-r border-brand-gray/60 last:border-none">
            <span className="text-[9px] font-black text-brand-primary/40 uppercase tracking-widest block mb-0.5">Est. Time Remaining</span>
            <span className="text-xl font-black text-brand-primary">
              {estMinutesLeft > 0 ? `${Math.floor(estMinutesLeft / 60)}h ${estMinutesLeft % 60}m` : 'Completed 🏆'}
            </span>
          </div>
          <div className="text-center p-2 last:border-none flex flex-col items-center justify-center">
            <span className="text-[9px] font-black text-brand-primary/40 uppercase tracking-widest block mb-0.5 flex-1 mt-1">Offline Sheets</span>
            <button
              onClick={() => window.print()}
              className="mt-0.5 bg-brand-secondary text-brand-primary text-[10px] font-bold px-3 py-1 rounded-lg hover:bg-[#d6f060] transition-all uppercase tracking-wider"
            >
              🖨️ Print sheets
            </button>
          </div>
        </div>
      )}

      {/* 🥇 Completed Tournament Podium (Organizers & Spectators) */}
      {totalRemaining === 0 && (() => {
        const podium = getPodiumWinners();
        if (!podium.gold && !podium.silver) return null;

        return (
          <div className="bg-white p-6 rounded-3xl border border-brand-gray/80 shadow-soft space-y-6 font-sans text-center select-none animate-fade-in mb-6">
            <div className="border-b border-brand-gray pb-3 flex justify-between items-center">
              <h3 className="text-sm font-extrabold text-brand-primary uppercase tracking-wider flex items-center gap-2">
                🏆 SmashBoard Champion Podium
              </h3>
              {!readOnly && (
                <button
                  onClick={exportDuprCsv}
                  className="bg-brand-primary hover:bg-brand-primary/95 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-xl uppercase tracking-wider transition-colors"
                >
                  📊 Export DUPR CSV
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-end justify-center gap-6 pt-8 pb-4 max-w-2xl mx-auto">
              
              {/* 🥈 2nd Place Silver Column */}
              {podium.silver && (
                <div className="w-full sm:w-44 flex flex-col items-center">
                  <div className="text-xs font-bold text-brand-primary mb-2 line-clamp-1">{podium.silver.name}</div>
                  <div className="w-full h-32 bg-slate-100 border border-slate-200 shadow-sm rounded-t-2xl flex flex-col items-center justify-between p-3 relative">
                    <span className="text-3xl absolute -top-5">🥈</span>
                    <span className="text-sm font-black text-slate-400 mt-2">2nd Place</span>
                    {!readOnly && (
                      <button
                        onClick={() => downloadAwardGraphic(podium.silver.name, '2nd Place')}
                        className="bg-white hover:bg-slate-50 border border-brand-gray rounded-lg px-2.5 py-1 text-[9px] font-bold text-brand-primary uppercase tracking-wider transition-colors"
                      >
                        Award Card
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 🥇 1st Place Gold Column */}
              {podium.gold && (
                <div className="w-full sm:w-48 flex flex-col items-center order-first sm:order-none">
                  <div className="text-sm font-black text-brand-primary mb-2 line-clamp-1 flex items-center gap-1">
                    👑 {podium.gold.name}
                  </div>
                  <div className="w-full h-44 bg-brand-secondary/15 border border-brand-secondary/40 shadow-soft rounded-t-3xl flex flex-col items-center justify-between p-4 relative">
                    <span className="text-4xl absolute -top-7 animate-pulse">🥇</span>
                    <span className="text-base font-black text-brand-primary mt-2">CHAMPION</span>
                    {!readOnly && (
                      <button
                        onClick={() => downloadAwardGraphic(podium.gold.name, 'Champion')}
                        className="bg-brand-primary hover:bg-brand-primary/95 text-white rounded-xl px-4 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors shadow-soft"
                      >
                        Award Card
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 🥉 3rd Place Bronze Column */}
              {podium.bronze && (
                <div className="w-full sm:w-44 flex flex-col items-center">
                  <div className="text-xs font-bold text-brand-primary mb-2 line-clamp-1">{podium.bronze.name}</div>
                  <div className="w-full h-24 bg-amber-50/50 border border-amber-200/50 shadow-sm rounded-t-2xl flex flex-col items-center justify-between p-3 relative">
                    <span className="text-3xl absolute -top-5">🥉</span>
                    <span className="text-sm font-black text-amber-700 mt-2">3rd Place</span>
                    {!readOnly && (
                      <button
                        onClick={() => downloadAwardGraphic(podium.bronze.name, '3rd Place')}
                        className="bg-white hover:bg-amber-50/20 border border-brand-gray rounded-lg px-2.5 py-1 text-[9px] font-bold text-brand-primary uppercase tracking-wider transition-colors"
                      >
                        Award Card
                      </button>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        );
      })()}

      {/* 🏟️ INTERACTIVE COURTS DASHBOARD (Organizers Only) */}
      {!readOnly && (
        <div className="bg-white p-5 rounded-3xl border border-brand-gray/80 shadow-soft space-y-4 font-sans select-none">
          <div className="flex items-center justify-between border-b border-brand-gray pb-3">
            <h3 className="text-sm font-extrabold text-brand-primary uppercase tracking-wider flex items-center gap-2">
              🏟️ Court Manager & Officiating Planner
            </h3>
            <span className="text-[10px] font-bold text-brand-primary/50 uppercase tracking-widest">
              Drag standby matches onto empty courts to assign
            </span>
          </div>

          {/* Grid of Courts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {courtAssignments.map(court => {
              const activeMatch = court.matchId ? allMatches.find(m => m.id === court.matchId) : null;
              const isOccupied = !!court.matchId;

              return (
                <div
                  key={court.courtNumber}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, court.courtNumber)}
                  className={`rounded-2xl border p-4 space-y-3 transition-all flex flex-col justify-between min-h-[175px]
                    ${isOccupied ? 'border-brand-secondary/35 bg-brand-secondary/[0.02]' : 'border-dashed border-brand-gray/80 bg-brand-light/30 hover:bg-brand-gray/10'}`}
                >
                  {/* Court Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-brand-primary">Court {court.courtNumber}</span>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider
                      ${court.status === 'playing' ? 'bg-green-500/20 text-green-600' : court.status === 'warming_up' ? 'bg-orange-500/20 text-orange-600 animate-pulse' : 'bg-gray-100 text-gray-500'}`}>
                      {court.status === 'playing' ? 'playing' : court.status === 'warming_up' ? 'warmup' : 'empty'}
                    </span>
                  </div>

                  {/* Assigned Match Details */}
                  {activeMatch ? (
                    <div className="space-y-2 flex-1 flex flex-col justify-center">
                      <div className="text-[10px] font-black text-brand-primary/40 uppercase tracking-widest">{activeMatch.id}</div>
                      <div className="text-xs font-bold text-brand-primary line-clamp-2">
                        {activeMatch.team1?.name} <span className="opacity-40 block font-semibold text-[10px] my-0.5 text-center">vs</span> {activeMatch.team2?.name}
                      </div>
                      <div className="pt-1">{renderCourtTimer(court)}</div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-brand-primary/40 p-2">
                      <span className="text-2xl mb-1">🎾</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider">Empty Court</span>
                      
                      {/* Touchscreen dropdown assign fallback */}
                      {standbyMatches.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) assignMatchToCourt(e.target.value, court.courtNumber);
                          }}
                          className="mt-2 text-[9px] font-bold border border-brand-gray/80 rounded bg-white p-1 text-brand-primary max-w-[110px]"
                        >
                          <option value="">+ Assign</option>
                          {standbyMatches.map(m => (
                            <option key={m.id} value={m.id}>{m.id} ({m.team1?.name?.split(' / ')[0]} v...)</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {/* Court Operations controls */}
                  {isOccupied && (
                    <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-brand-gray/60">
                      {court.status === 'warming_up' ? (
                        <button
                          onClick={() => startMatchPlay(court.courtNumber)}
                          className="py-1 rounded-lg bg-green-500 text-white font-bold text-[9px] hover:bg-green-600 transition-colors uppercase tracking-wider"
                        >
                          ▶ Play
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (activeMatch) openScoreModal(activeMatch);
                          }}
                          className="py-1 rounded-lg bg-brand-secondary text-brand-primary font-bold text-[9px] hover:bg-[#d6f060] transition-colors uppercase tracking-wider"
                        >
                          ✓ Score
                        </button>
                      )}
                      <button
                        onClick={() => pingPlayersForMatch(court.matchId, court.courtNumber)}
                        className="py-1 rounded-lg bg-brand-primary text-white font-bold text-[9px] hover:bg-brand-primary/90 transition-colors uppercase tracking-wider"
                      >
                        📢 Ping
                      </button>
                      <button
                        onClick={() => releaseCourt(court.courtNumber)}
                        className="col-span-2 py-0.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-700 font-bold text-[8px] transition-colors uppercase tracking-widest"
                      >
                        ✕ Release Court
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 📋 Standby Match Queue */}
          {standbyMatches.length > 0 ? (
            <div className="space-y-2.5 pt-3 border-t border-brand-gray/80">
              <span className="text-[10px] font-black text-brand-primary/50 uppercase tracking-widest block">
                📋 Standby Match Queue ({standbyMatches.length} Matches Ready)
              </span>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {standbyMatches.map(match => (
                  <div
                    key={match.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, match.id)}
                    className="flex-shrink-0 w-48 bg-brand-light/35 border border-brand-gray/60 rounded-xl p-3 shadow-[0_2px_10px_rgb(0,0,0,0.01)] hover:border-brand-secondary cursor-grab active:cursor-grabbing select-none hover:-translate-y-0.5 transition-all"
                  >
                    <div className="flex justify-between items-center text-[8px] font-black text-brand-primary/40 uppercase mb-1.5">
                      <span>{match.id}</span>
                      <span className="text-[7px] bg-brand-secondary/40 text-brand-primary px-1.5 py-0.2 rounded font-extrabold uppercase">Ready</span>
                    </div>
                    <div className="text-[11px] font-bold text-brand-primary truncate">{match.team1?.name}</div>
                    <div className="text-[8px] font-semibold text-brand-primary/40 text-center uppercase tracking-widest my-0.5">vs</div>
                    <div className="text-[11px] font-bold text-brand-primary truncate">{match.team2?.name}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-[10px] font-black text-brand-primary/30 uppercase tracking-widest py-3 border-t border-brand-gray/80">
              📋 Standby Match Queue Empty (All ready matches assigned or on court!)
            </div>
          )}
        </div>
      )}

      {/* Tab Navigation for Double Elimination */}
      {type === 'double_elim' && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setActiveTab('winners')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all uppercase tracking-wider
              ${activeTab === 'winners' ? 'bg-brand-primary text-white shadow-soft' : 'bg-white text-brand-primary border border-brand-gray/80 hover:bg-brand-gray/40'}`}
          >
            🏆 Winners Bracket
          </button>
          <button
            onClick={() => setActiveTab('consolation')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all uppercase tracking-wider
              ${activeTab === 'consolation' ? 'bg-brand-primary text-white shadow-soft' : 'bg-white text-brand-primary border border-brand-gray/80 hover:bg-brand-gray/40'}`}
          >
            Consolation Bracket
          </button>
          <button
            onClick={() => setActiveTab('grand_finals')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all uppercase tracking-wider
              ${activeTab === 'grand_finals' ? 'bg-brand-primary text-white shadow-soft' : 'bg-white text-brand-primary border border-brand-gray/80 hover:bg-brand-gray/40'}`}
          >
            👑 Grand Finals
          </button>
        </div>
      )}

      {/* Bracket Scroll Container */}
      <div className="bg-brand-light/30 border border-brand-gray/50 rounded-3xl p-6 overflow-x-auto min-h-[500px] shadow-[inset_0_4px_30px_rgba(0,0,0,0.01)]">
        
        {/* Winners Bracket View */}
        {activeTab === 'winners' && (
          <div className="flex gap-12 items-center min-w-max py-8">
            {Object.keys(winnersByRound).map(roundNum => {
              const r = parseInt(roundNum);
              const matches = winnersByRound[r];
              let roundLabel = `Round ${r}`;
              if (r === numRounds) roundLabel = 'Championship';
              else if (r === numRounds - 1) roundLabel = 'Semifinals';
              else if (r === numRounds - 2) roundLabel = 'Quarterfinals';

              return (
                <div key={roundNum} className="flex flex-col items-center justify-around h-[420px] space-y-4">
                  <div className="text-xs font-black uppercase text-brand-primary/40 tracking-wider text-center select-none">
                    {roundLabel}
                  </div>
                  <div className="flex flex-col justify-around h-full space-y-4">
                    {matches.map(renderMatchCard)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Consolation Bracket View */}
        {activeTab === 'consolation' && type === 'double_elim' && (
          <div className="flex gap-12 items-center min-w-max py-8">
            {Object.keys(consolationByRound).map(roundNum => {
              const r = parseInt(roundNum);
              const matches = consolationByRound[r];
              let roundLabel = `Consolation Rd ${r}`;
              if (r === totalConsolationRounds) roundLabel = 'Consolation Finals';

              return (
                <div key={roundNum} className="flex flex-col items-center justify-around h-[420px] space-y-4">
                  <div className="text-xs font-black uppercase text-brand-primary/40 tracking-wider text-center select-none">
                    {roundLabel}
                  </div>
                  <div className="flex flex-col justify-around h-full space-y-4">
                    {matches.map(renderMatchCard)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Grand Finals View */}
        {activeTab === 'grand_finals' && type === 'double_elim' && (
          <div className="flex justify-center items-center h-[420px] max-w-xl mx-auto gap-8">
            {grandFinalsMatches.map((match, idx) => {
              const isActive = match.status !== 'skipped';
              if (!isActive) return null;

              return (
                <div key={match.id} className="flex flex-col items-center space-y-3">
                  <div className="text-xs font-black uppercase text-brand-primary/40 tracking-wider select-none">
                    Grand Finals {idx === 1 ? '(If Needed)' : 'Match 1'}
                  </div>
                  {renderMatchCard(match)}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Self-contained Click-to-Score / Substitution modal */}
      {selectedMatch && !readOnly && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-brand-primary/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-brand-gray shadow-soft my-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-brand-primary">
                {isSubbing ? '🔄 Partner Substitution' : `Match score entry (${selectedMatch.id})`}
              </h3>
              <button onClick={() => setSelectedMatch(null)} className="text-lg text-brand-primary/40 hover:text-brand-primary">✕</button>
            </div>

            {/* Substitution Roster Form */}
            {isSubbing ? (
              <form onSubmit={confirmPlayerSwap} className="space-y-4">
                <div className="space-y-3 bg-brand-light/35 border border-brand-gray/60 p-4 rounded-2xl select-none">
                  <div>
                    <label className="text-[10px] font-black text-brand-primary/50 uppercase tracking-widest block mb-1">Select Side</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setSubSide(1); setSubPlayerIdx(0); }}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border
                          ${subSide === 1 ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-brand-primary border-brand-gray hover:bg-brand-gray/30'}`}
                      >
                        {selectedMatch.team1?.name?.split(' / ')[0] || 'Team 1'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSubSide(2); setSubPlayerIdx(0); }}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border
                          ${subSide === 2 ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-brand-primary border-brand-gray hover:bg-brand-gray/30'}`}
                      >
                        {selectedMatch.team2?.name?.split(' / ')[0] || 'Team 2'}
                      </button>
                    </div>
                  </div>

                  {/* Choose Partner to swap if doubles */}
                  {((subSide === 1 ? selectedMatch.team1 : selectedMatch.team2)?.name?.includes(' / ')) && (
                    <div className="pt-2">
                      <label className="text-[10px] font-black text-brand-primary/50 uppercase tracking-widest block mb-1">Select Player to Replace</label>
                      <div className="flex gap-2">
                        {((subSide === 1 ? selectedMatch.team1 : selectedMatch.team2)?.name?.split(' / ') || []).map((name, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSubPlayerIdx(idx)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border
                              ${subPlayerIdx === idx ? 'bg-brand-secondary text-brand-primary border-brand-secondary font-bold' : 'bg-white text-brand-primary border-brand-gray hover:bg-brand-gray/30'}`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <label className="text-[10px] font-black text-brand-primary/50 uppercase tracking-widest block mb-1">Select Replacement Standby</label>
                    {standbyRoster.length > 0 ? (
                      <select
                        required
                        value={selectedSubPlayerId}
                        onChange={(e) => setSelectedSubPlayerId(e.target.value)}
                        className="w-full h-11 border border-brand-primary/10 rounded-xl px-3 font-semibold text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      >
                        <option value="">-- Checked-In Standby Players --</option>
                        {standbyRoster.map(p => (
                          <option key={p.id} value={p.id}>{p.name} (DUPR {p.rating || 'Unrated'})</option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-center text-[10px] text-red-500 font-bold uppercase tracking-wide py-2 bg-red-50/50 rounded-lg">
                        ⚠️ No checked-in standby players available!
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSubbing(false)}
                    className="flex-1 h-11 border border-brand-primary/15 rounded-xl font-bold text-sm text-brand-primary/80 hover:bg-brand-gray/20 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedSubPlayerId}
                    className="flex-1 h-11 bg-brand-secondary text-brand-primary font-bold text-sm rounded-xl hover:bg-[#d6f060] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Confirm Swap
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSaveScore} className="space-y-4">
                <div className="space-y-3">
                  {/* Team 1 Score */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold truncate max-w-[200px] text-brand-primary">
                      {selectedMatch.team1?.name || 'TBD'}
                    </span>
                    <input
                      type="number"
                      min="0"
                      required
                      value={score1}
                      onChange={(e) => setScore1(e.target.value)}
                      className="w-20 h-10 border border-brand-primary/10 rounded-xl text-center font-bold text-base bg-brand-light focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      placeholder="0"
                    />
                  </div>

                  <div className="border-t border-brand-gray/60 my-2" />

                  {/* Team 2 Score */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold truncate max-w-[200px] text-brand-primary">
                      {selectedMatch.team2?.name || 'TBD'}
                    </span>
                    <input
                      type="number"
                      min="0"
                      required
                      value={score2}
                      onChange={(e) => setScore2(e.target.value)}
                      className="w-20 h-10 border border-brand-primary/10 rounded-xl text-center font-bold text-base bg-brand-light focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* 🔄 substitution Quick Trigger */}
                {onUpdateBracket && standbyRoster.length > 0 && selectedMatch.status === 'scheduled' && (
                  <button
                    type="button"
                    onClick={() => { setIsSubbing(true); setSelectedSubPlayerId(''); }}
                    className="w-full py-2 border border-dashed border-brand-primary/20 hover:border-brand-secondary hover:bg-brand-secondary/5 rounded-2xl font-bold text-xs text-brand-primary transition-all uppercase tracking-wider"
                  >
                    🔄 Substitute Injured/Missing Player
                  </button>
                )}

                {/* ⚠️ Forfeit & Walkover Panel */}
                <div className="bg-red-50/50 border border-red-200/50 rounded-2xl p-3.5 space-y-2 mt-4 select-none">
                  <div className="text-[10px] font-black text-red-800 uppercase tracking-widest">
                    ⚠️ Officiating Walkover / Forfeit
                  </div>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        const confirmed = window.confirm(`Declare walkover/forfeit for ${selectedMatch.team1?.name}? ${selectedMatch.team2?.name} will advance.`);
                        if (confirmed) {
                          // Clear from court assignments
                          const updated = [...courtAssignments];
                          const idx = updated.findIndex(c => c.matchId === selectedMatch.id);
                          if (idx !== -1) {
                            updated[idx] = { courtNumber: updated[idx].courtNumber, matchId: null, status: 'available', timerStart: null, timerMode: null };
                            updateCourts(updated);
                          }
                          onMatchScore(selectedMatch.id, 2, { score1: 0, score2: 1 });
                          setSelectedMatch(null);
                        }
                      }}
                      className="flex-1 py-2 rounded-xl bg-red-100/60 hover:bg-red-200/60 text-red-800 font-bold text-xs transition-colors"
                    >
                      {selectedMatch.team1?.name?.split(' / ')[0]} Forfeit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const confirmed = window.confirm(`Declare walkover/forfeit for ${selectedMatch.team2?.name}? ${selectedMatch.team1?.name} will advance.`);
                        if (confirmed) {
                          // Clear from court assignments
                          const updated = [...courtAssignments];
                          const idx = updated.findIndex(c => c.matchId === selectedMatch.id);
                          if (idx !== -1) {
                            updated[idx] = { courtNumber: updated[idx].courtNumber, matchId: null, status: 'available', timerStart: null, timerMode: null };
                            updateCourts(updated);
                          }
                          onMatchScore(selectedMatch.id, 1, { score1: 1, score2: 0 });
                          setSelectedMatch(null);
                        }
                      }}
                      className="flex-1 py-2 rounded-xl bg-red-100/60 hover:bg-red-200/60 text-red-800 font-bold text-xs transition-colors"
                    >
                      {selectedMatch.team2?.name?.split(' / ')[0]} Forfeit
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedMatch(null)}
                    className="flex-1 h-11 border border-brand-primary/15 rounded-xl font-bold text-sm text-brand-primary/80 hover:bg-brand-gray/20 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-11 bg-brand-secondary text-brand-primary font-bold text-sm rounded-xl hover:bg-[#d6f060] transition-all"
                  >
                    Save &amp; Advance
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>

    {/* 📄 Print Section for offline physical score sheets */}
    <div id="print-section" className="hidden print:block w-full p-4 font-sans bg-white text-black">
      <div className="text-center border-b-2 border-black pb-4 mb-6">
        <h1 className="text-2xl font-black uppercase tracking-wider">SmashBoard Official Scorecard Packet</h1>
        <p className="text-xs font-semibold mt-1">Date: {new Date().toLocaleDateString()} · Generated via DinkSync</p>
      </div>
      
      <div className="grid grid-cols-1 gap-8">
        {allMatches.filter(m => m.status === 'scheduled' && m.team1 && m.team2 && m.team1.name !== 'TBD' && m.team2.name !== 'TBD').map(match => (
          <div key={match.id} className="border-2 border-black rounded-2xl p-6 space-y-4 page-break-inside-avoid">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Match ID: {match.id}</span>
              <span className="text-xs font-bold uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">Elimination Bracket</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="border-r pr-4">
                <span className="text-[9px] uppercase font-bold text-gray-400">Team 1</span>
                <div className="text-base font-bold mt-1 truncate">{match.team1?.name}</div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">Game 1:</span>
                    <div className="w-16 h-8 border border-black rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">Game 2:</span>
                    <div className="w-16 h-8 border border-black rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">Game 3:</span>
                    <div className="w-16 h-8 border border-black rounded" />
                  </div>
                </div>
              </div>
              
              <div className="pl-4">
                <span className="text-[9px] uppercase font-bold text-gray-400">Team 2</span>
                <div className="text-base font-bold mt-1 truncate">{match.team2?.name}</div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">Game 1:</span>
                    <div className="w-16 h-8 border border-black rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">Game 2:</span>
                    <div className="w-16 h-8 border border-black rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">Game 3:</span>
                    <div className="w-16 h-8 border border-black rounded" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-4 grid grid-cols-3 gap-4 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              <div className="border-t pt-8 border-dashed border-gray-300">Team 1 Signature</div>
              <div className="border-t pt-8 border-dashed border-gray-300">Team 2 Signature</div>
              <div className="border-t pt-8 border-dashed border-gray-300">Referee/Staff Signature</div>
            </div>
          </div>
        ))}
      </div>
    </div>
    </>
  );
}
