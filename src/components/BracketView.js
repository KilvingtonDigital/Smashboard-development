import React, { useState } from 'react';

export default function BracketView({ bracket, onMatchScore, readOnly = false }) {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [activeTab, setActiveTab] = useState('winners'); // 'winners' | 'consolation' | 'grand_finals'

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
  
  const courtsAvailable = bracket.courts || 4;
  const avgMatchDuration = 15; // 15 mins average
  const estRoundsLeft = Math.ceil(totalRemaining / courtsAvailable);
  const estMinutesLeft = estRoundsLeft * avgMatchDuration;

  // Group winners matches by round
  const winnersByRound = {};
  for (let r = 1; r <= numRounds; r++) {
    winnersByRound[r] = winnersMatches.filter(m => m.round === r);
  }

  // Group consolation matches by round
  const consolationByRound = {};
  const totalConsolationRounds = (numRounds - 1) * 2;
  if (type === 'double_elim' && consolationMatches.length > 0) {
    for (let r = 1; r <= totalConsolationRounds; r++) {
      consolationByRound[r] = consolationMatches.filter(m => m.round === r);
    }
  }

  const openScoreModal = (match) => {
    if (readOnly) return; // Disabled in spectator read-only mode
    if (match.status === 'bye' || match.status === 'skipped') return;
    setSelectedMatch(match);
    setScore1(match.score1 || '');
    setScore2(match.score2 || '');
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

    const winnerSide = s1 > s2 ? 1 : 2;
    onMatchScore(selectedMatch.id, winnerSide, { score1: s1, score2: s2 });
    setSelectedMatch(null);
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

    return (
      <div
        key={match.id}
        onClick={() => openScoreModal(match)}
        className={`w-52 bg-white rounded-2xl p-3 border shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all select-none
          ${isBye ? 'border-brand-secondary/30 bg-brand-secondary/5 opacity-80 cursor-default' : ''}
          ${!isBye && !readOnly ? 'border-brand-gray hover:border-brand-secondary hover:shadow-[0_8px_30px_rgba(214,240,96,0.15)] cursor-pointer hover:-translate-y-0.5' : 'border-brand-gray/80'}
          ${isCompleted ? 'bg-brand-light/50' : ''}`}
      >
        <div className="flex justify-between items-center text-[9px] font-bold text-brand-primary/40 uppercase tracking-widest mb-2">
          <span>{match.id}</span>
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
    <div className="space-y-6">
      
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
          <div className="text-center p-2 last:border-none">
            <span className="text-[9px] font-black text-brand-primary/40 uppercase tracking-widest block mb-0.5">Parallel Efficiency</span>
            <span className="text-xl font-black text-brand-primary">
              {totalRemaining > 0 ? `${Math.min(100, Math.round((courtsAvailable / Math.max(1, totalRemaining)) * 100))}%` : '100%'}
            </span>
          </div>
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

      {/* Self-contained Click-to-Score modal */}
      {selectedMatch && !readOnly && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-brand-primary/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-brand-gray shadow-soft my-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-brand-primary">Match score entry ({selectedMatch.id})</h3>
              <button onClick={() => setSelectedMatch(null)} className="text-lg text-brand-primary/40 hover:text-brand-primary">✕</button>
            </div>

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
          </div>
        </div>
      )}
    </div>
  );
}
