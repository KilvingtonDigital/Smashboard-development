import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import InstallPrompt from './InstallPrompt';
import ScoreModal from './components/ScoreModal';
import DebugPanel, { useDebugLog } from './components/DebugPanel';
import { useAuth } from './contexts/AuthContext';
import { useAPI } from './hooks/useAPI';
import { useSessionSync } from './hooks/useSessionSync';
import { generateSinglesRound } from './schedulers/singlesScheduler';
import { generateRoundRobinRound, selectBestGroupOfFour, findBestTeamSplit } from './schedulers/doublesScheduler';
import { generateTeamedDoublesRound } from './schedulers/teamedDoublesScheduler';
import {
  generateKingOfCourtRound, initializeKingOfCourtStats, updateKOTStats,
  generateKingOfCourtTeamedRound, initializeKingOfCourtTeamStats, updateKOTTeamStats,
  generateBalancedKOTTeams
} from './schedulers/kingOfCourtScheduler';

// Version 3.2 - King of Court implementation + Round Robin

/* =====================  BRAND UI PRIMITIVES  ===================== */
const Button = ({ className = '', ...props }) => (
  <button
    className={`inline-flex items-center justify-center rounded-xl px-4 h-11 text-sm font-semibold shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-secondary ${className}`}
    {...props}
  />
);
const Card = ({ className = '', ...props }) => (
  <div className={`rounded-2xl border border-brand-gray bg-brand-light p-3 sm:p-4 shadow-soft ${className}`} {...props} />
);
const Field = ({ label, children, hint }) => (
  <label className="block text-sm font-medium text-brand-primary">
    <span>{label}</span>
    <div className="mt-1">{children}</div>
    {hint ? <p className="mt-1 text-xs text-brand-primary/70">{hint}</p> : null}
  </label>
);

/* =====================  HELPERS  ===================== */
const ENABLE_KOT_V2 = false; // Set to true to enable King of Court (V2 feature)
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const avg = (t) => (t[0].rating + t[1].rating) / 2;

/* ---- Build export payload ---- */
const buildResults = (players, rounds, meta, kotStats = null) => {
  const matches = [];
  rounds.forEach((r, rIdx) =>
    r.forEach((m) => {
      // Only export completed matches — skip pending and removed
      if (m.status !== 'completed') return;

      // For best-of-3, sum game scores into score1/score2 if not already set
      let rawScore1 = m.score1;
      let rawScore2 = m.score2;
      if (m.matchFormat === 'best_of_3' && (rawScore1 === '' || rawScore1 == null) && (rawScore2 === '' || rawScore2 == null)) {
        rawScore1 = (Number(m.game1Score1) || 0) + (Number(m.game2Score1) || 0) + (Number(m.game3Score1) || 0);
        rawScore2 = (Number(m.game1Score2) || 0) + (Number(m.game2Score2) || 0) + (Number(m.game3Score2) || 0);
      }

      const s1 = typeof rawScore1 === 'number' || (typeof rawScore1 === 'string' && rawScore1.trim() !== '') ? Number(rawScore1) : null;
      const s2 = typeof rawScore2 === 'number' || (typeof rawScore2 === 'string' && rawScore2.trim() !== '') ? Number(rawScore2) : null;

      // Handle both singles (player1/player2) and doubles (team1/team2) formats
      let team1Data, team2Data;
      if (m.gameFormat === 'singles') {
        // Singles: create single-player arrays for consistency
        team1Data = m.player1 ? [{ id: m.player1.id, name: m.player1.name, rating: m.player1.rating }] : [];
        team2Data = m.player2 ? [{ id: m.player2.id, name: m.player2.name, rating: m.player2.rating }] : [];
      } else {
        // Doubles/Teamed: use team arrays
        team1Data = m.team1?.map((p) => ({ id: p.id, name: p.name, rating: p.rating })) || [];
        team2Data = m.team2?.map((p) => ({ id: p.id, name: p.name, rating: p.rating })) || [];
      }

      // For best of 3, use the match winner directly
      let winner = null;
      if (m.status === 'completed') {
        if (m.winner) {
          winner = m.winner; // Use pre-calculated winner
        } else {
          // Fallback for single match format
          winner = s1 > s2 ? 'team1' : 'team2';
        }
      }

      matches.push({
        round: rIdx + 1,
        court: m.court,
        courtLevel: m.courtLevel || null,
        gameFormat: m.gameFormat || 'doubles',
        team1: team1Data,
        team2: team2Data,
        score1: s1,
        score2: s2,
        // Include individual game scores for best of 3
        game1Score1: m.game1Score1 ?? '',
        game1Score2: m.game1Score2 ?? '',
        game2Score1: m.game2Score1 ?? '',
        game2Score2: m.game2Score2 ?? '',
        game3Score1: m.game3Score1 ?? '',
        game3Score2: m.game3Score2 ?? '',
        matchFormat: m.matchFormat || 'single_match',
        status: m.status,
        winner: winner,
        pointsAwarded: m.pointsAwarded || null,
        startTime: m.startTime || '',
        endTime: m.endTime || '',
        durationMinutes: m.durationMinutes || ''
      });
    })
  );
  return {
    generatedAt: new Date().toISOString(),
    players,
    matches,
    meta,
    kingOfCourtStats: kotStats
  };
};

/* ---- CSV + download ---- */
const toCSV = (results) => {
  const header = [
    'round', 'court', 'court_level', 'game_format',
    't1_p1', 't1_p1_rating', 't1_p2', 't1_p2_rating',
    't2_p1', 't2_p1_rating', 't2_p2', 't2_p2_rating',
    'match_format', 'score1', 'score2', 'games_won_t1', 'games_won_t2',
    'game1_t1', 'game1_t2', 'game2_t1', 'game2_t2', 'game3_t1', 'game3_t2',
    'winner', 'points_awarded', 'start_time', 'end_time', 'duration_minutes'
  ];
  const rows = results.matches.map((m) => {
    // Calculate games won for best of 3
    let gamesWonT1 = 0;
    let gamesWonT2 = 0;
    if (m.matchFormat === 'best_of_3') {
      const g1s1 = Number(m.game1Score1) || 0;
      const g1s2 = Number(m.game1Score2) || 0;
      if (g1s1 > g1s2) gamesWonT1++;
      else if (g1s2 > g1s1) gamesWonT2++;

      const g2s1 = Number(m.game2Score1) || 0;
      const g2s2 = Number(m.game2Score2) || 0;
      if (g2s1 > g2s2) gamesWonT1++;
      else if (g2s2 > g2s1) gamesWonT2++;

      const g3s1 = Number(m.game3Score1) || 0;
      const g3s2 = Number(m.game3Score2) || 0;
      if (g3s1 > g3s2) gamesWonT1++;
      else if (g3s2 > g3s1) gamesWonT2++;
    }

    return [
      m.round, m.court, m.courtLevel || '', m.gameFormat || '',
      m.team1?.[0]?.name || '',
      m.team1?.[0]?.rating || '',
      m.team1?.[1]?.name || '',
      m.team1?.[1]?.rating || '',
      m.team2?.[0]?.name || '',
      m.team2?.[0]?.rating || '',
      m.team2?.[1]?.name || '',
      m.team2?.[1]?.rating || '',
      m.matchFormat || 'single_match',
      m.score1 ?? '', m.score2 ?? '',
      gamesWonT1, gamesWonT2,
      m.game1Score1 ?? '', m.game1Score2 ?? '',
      m.game2Score1 ?? '', m.game2Score2 ?? '',
      m.game3Score1 ?? '', m.game3Score2 ?? '',
      m.winner || '',
      m.pointsAwarded || '',
      m.startTime || '', m.endTime || '', m.durationMinutes || ''
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  return [header.join(','), ...rows].join('\n');
};

const downloadFile = (filename, content, type = 'text/csv;charset=utf-8') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/* =====================  EMAIL (EmailJS) – OPTIONAL (silent)  ===================== */
const EMAILJS_SERVICE_ID = 'service_7c3umkg';
const EMAILJS_TEMPLATE_ID = 'template_g772hi6';
const EMAILJS_PUBLIC_KEY = '6sKFOLZBoZNoeSSw0';

async function emailCSV(csvText, filename) {
  try {
    const hasEmailJS =
      typeof window !== 'undefined' &&
      (window.emailjs || (window && window['emailjs']));
    if (!hasEmailJS || !EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) return false;
    const emailjs = window.emailjs || window['emailjs'];
    if (!emailjs) return false;

    await emailjs.init(EMAILJS_PUBLIC_KEY);
    const base64 = btoa(unescape(encodeURIComponent(csvText)));
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: 'info@kilvingtondigital.com',
      file_name: filename,
      file_data: base64,
      generated_at: new Date().toISOString(),
      session_meta: 'SmashBoard CSV archive'
    });
    return true;
  } catch { return false; }
}

/* =====================  SKILL-BASED SEPARATION HELPERS  ===================== */

const SKILL_LEVELS = {
  BEGINNER: { min: 2.0, max: 2.9, label: 'Beginner', color: 'bg-red-100 text-red-700' },
  ADVANCED_BEGINNER: { min: 3.0, max: 3.4, label: 'Advanced Beginner', color: 'bg-orange-100 text-orange-700' },
  INTERMEDIATE: { min: 3.5, max: 3.9, label: 'Intermediate', color: 'bg-yellow-100 text-yellow-700' },
  ADVANCED_INTERMEDIATE: { min: 4.0, max: 4.4, label: 'Advanced Intermediate', color: 'bg-green-100 text-green-700' },
  ADVANCED: { min: 4.5, max: 4.9, label: 'Advanced', color: 'bg-blue-100 text-blue-700' },
  EXPERT: { min: 5.0, max: 5.4, label: 'Expert', color: 'bg-purple-100 text-purple-700' },
  EXPERT_PRO: { min: 5.5, max: 6.0, label: 'Expert Pro', color: 'bg-pink-100 text-pink-700' }
};

const getPlayerSkillLevel = (rating) => {
  for (const [key, level] of Object.entries(SKILL_LEVELS)) {
    if (rating >= level.min && rating <= level.max) {
      return { key, ...level };
    }
  }
  return { key: 'BEGINNER', ...SKILL_LEVELS.BEGINNER };
};

const separatePlayersBySkill = (players, minPlayersPerLevel = 4) => {
  const skillGroups = {};
  Object.keys(SKILL_LEVELS).forEach(key => {
    skillGroups[key] = [];
  });

  players.forEach(player => {
    const skillLevel = getPlayerSkillLevel(player.rating);
    if (skillGroups[skillLevel.key]) {
      skillGroups[skillLevel.key].push(player);
    }
  });

  console.log('\n=== SKILL LEVEL DISTRIBUTION ===');
  Object.entries(skillGroups).forEach(([level, playerGroup]) => {
    if (playerGroup.length > 0) {
      console.log(`${SKILL_LEVELS[level].label}: ${playerGroup.length} players - ${playerGroup.map(p => `${p.name}(${p.rating})`).join(', ')}`);
    }
  });

  const bumpedPlayers = [];
  const levelKeys = Object.keys(SKILL_LEVELS);

  // First pass: Try bumping UP to next level
  for (let i = 0; i < levelKeys.length; i++) {
    const levelKey = levelKeys[i];
    const playerGroup = skillGroups[levelKey];

    if (playerGroup.length > 0 && playerGroup.length < minPlayersPerLevel) {
      let targetLevelIndex = i + 1;
      while (targetLevelIndex < levelKeys.length && skillGroups[levelKeys[targetLevelIndex]].length === 0) {
        targetLevelIndex++;
      }

      if (targetLevelIndex < levelKeys.length) {
        const targetLevel = levelKeys[targetLevelIndex];
        console.log(`BUMPING UP: ${playerGroup.map(p => p.name).join(', ')} from ${SKILL_LEVELS[levelKey].label} to ${SKILL_LEVELS[targetLevel].label}`);

        skillGroups[targetLevel].push(...playerGroup);
        bumpedPlayers.push(...playerGroup.map(p => ({ ...p, originalLevel: levelKey, bumpedLevel: targetLevel })));
        skillGroups[levelKey] = [];
      }
    }
  }

  // Second pass: Try bumping DOWN to previous level (for high-rated isolated players)
  for (let i = levelKeys.length - 1; i >= 0; i--) {
    const levelKey = levelKeys[i];
    const playerGroup = skillGroups[levelKey];

    if (playerGroup.length > 0 && playerGroup.length < minPlayersPerLevel) {
      let targetLevelIndex = i - 1;
      while (targetLevelIndex >= 0 && skillGroups[levelKeys[targetLevelIndex]].length === 0) {
        targetLevelIndex--;
      }

      if (targetLevelIndex >= 0) {
        const targetLevel = levelKeys[targetLevelIndex];
        console.log(`BUMPING DOWN: ${playerGroup.map(p => p.name).join(', ')} from ${SKILL_LEVELS[levelKey].label} to ${SKILL_LEVELS[targetLevel].label}`);

        skillGroups[targetLevel].push(...playerGroup);
        bumpedPlayers.push(...playerGroup.map(p => ({ ...p, originalLevel: levelKey, bumpedLevel: targetLevel })));
        skillGroups[levelKey] = [];
      }
    }
  }

  const finalGroups = [];
  const orphanedPlayers = []; // Track players not in any group

  Object.entries(skillGroups).forEach(([levelKey, playerGroup]) => {
    if (playerGroup.length >= minPlayersPerLevel) {
      finalGroups.push({
        level: levelKey,
        label: SKILL_LEVELS[levelKey].label,
        color: SKILL_LEVELS[levelKey].color,
        players: playerGroup,
        minRating: Math.min(...playerGroup.map(p => p.rating)),
        maxRating: Math.max(...playerGroup.map(p => p.rating))
      });
    } else if (playerGroup.length > 0) {
      // Collect orphaned players who couldn't be grouped
      orphanedPlayers.push(...playerGroup);
    }
  });

  // If there are orphaned players, add them to the closest skill group OR create a mixed group
  if (orphanedPlayers.length > 0) {
    console.warn(`⚠️ ${orphanedPlayers.length} orphaned players: ${orphanedPlayers.map(p => p.name).join(', ')}`);

    if (finalGroups.length > 0) {
      // Add to the closest skill group (by rating)
      orphanedPlayers.forEach(orphan => {
        let closestGroup = finalGroups[0];
        let smallestRatingDiff = Math.abs(orphan.rating - (closestGroup.minRating + closestGroup.maxRating) / 2);

        finalGroups.forEach(group => {
          const groupAvg = (group.minRating + group.maxRating) / 2;
          const diff = Math.abs(orphan.rating - groupAvg);
          if (diff < smallestRatingDiff) {
            smallestRatingDiff = diff;
            closestGroup = group;
          }
        });

        console.log(`Adding ${orphan.name} (${orphan.rating}) to ${closestGroup.label} group`);
        closestGroup.players.push(orphan);
        closestGroup.minRating = Math.min(closestGroup.minRating, orphan.rating);
        closestGroup.maxRating = Math.max(closestGroup.maxRating, orphan.rating);
        bumpedPlayers.push({ ...orphan, originalLevel: getPlayerSkillLevel(orphan.rating).key, bumpedLevel: closestGroup.level });
      });
    } else {
      // No groups exist - create a mixed group with all players
      console.log(`Creating mixed group with all ${players.length} players`);
      finalGroups.push({
        level: 'MIXED',
        label: 'Mixed',
        color: 'bg-gray-100 text-gray-700',
        players: [...players],
        minRating: Math.min(...players.map(p => p.rating)),
        maxRating: Math.max(...players.map(p => p.rating))
      });
    }
  }

  console.log(`\n=== FINAL SKILL GROUPS (${finalGroups.length} groups) ===`);
  finalGroups.forEach((group, idx) => {
    console.log(`Group ${idx + 1} - ${group.label}: ${group.players.length} players (${group.minRating.toFixed(1)}-${group.maxRating.toFixed(1)})`);
  });

  return { groups: finalGroups, bumpedPlayers };
};

const canPlayTogether = (player1, player2) => {
  const level1 = getPlayerSkillLevel(player1.rating);
  const level2 = getPlayerSkillLevel(player2.rating);

  const level1Index = Object.keys(SKILL_LEVELS).indexOf(level1.key);
  const level2Index = Object.keys(SKILL_LEVELS).indexOf(level2.key);

  return Math.abs(level1Index - level2Index) <= 1;
};

/* =====================  MAIN COMPONENT  ===================== */
const PickleballTournamentManager = () => {
  const { user } = useAuth();
  const api = useAPI();
  const { loadSession, saveSession, clearSession } = useSessionSync();
  const isClearingSession = useRef(false); // prevents autosave race during End & Clear
  const sessionRestoredRef = useRef(false); // prevents autosave from firing before restore
  const [players, setPlayers] = useState([]);
  const [form, setForm] = useState({ name: '', rating: '', gender: 'male' });
  const [bulkText, setBulkText] = useState('');
  const [addNote, setAddNote] = useState(null);


  const [courts, setCourts] = useState(4);
  const [sessionMinutes, setSessionMinutes] = useState(120);
  const [minutesPerRound, setMinutesPerRound] = useState(20);

  const [tournamentType, setTournamentType] = useState('round_robin');
  const [gameFormat, setGameFormat] = useState('doubles'); // doubles, teamed_doubles, singles
  const [matchFormat, setMatchFormat] = useState('single_match'); // single_match, best_of_3
  const [teams, setTeams] = useState([]); // For teamed doubles: [{id, player1, player2, gender}]
  const [teamBuilderSelected, setTeamBuilderSelected] = useState(null); // player id pending pair in Team Builder
  const [kotAutoTeams, setKotAutoTeams] = useState([]); // For King of Court auto-generated fixed teams
  const [separateBySkill, setSeparateBySkill] = useState(true);
  const [preferMixedDoubles, setPreferMixedDoubles] = useState(true);  // Gender-aware pairing for doubles
  const [femaleRestInterval, setFemaleRestInterval] = useState(2);     // Rest after N consecutive rounds

  const [rounds, setRounds] = useState([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [playerStats, setPlayerStats] = useState({});
  const [kotStats, setKotStats] = useState({});
  const [kotTeamStats, setKotTeamStats] = useState({}); // For King of Court with teams
  const [teamStats, setTeamStats] = useState({}); // For teamed doubles
  const [courtStates, setCourtStates] = useState([]); // Court flow management: [{courtNumber, status, currentMatch}]

  const [tab, setTab] = useState('setup');
  const [endOpen, setEndOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [exportedThisSession, setExportedThisSession] = useState(false);
  const [locked, setLocked] = useState(false);
  const [tournamentName, setTournamentName] = useState('');
  const [scoreSheet, setScoreSheet] = useState(null); // { courtNumber } | null
  // Schedule sub-tab: 'courts' | 'rounds'
  const [scheduleView, setScheduleView] = useState('rounds');
  // Help sheet
  const [helpOpen, setHelpOpen] = useState(false);

  const [debugLog, addDebug] = useDebugLog();

  // Restore session on mount — backend first, localStorage as fallback
  useEffect(() => {
    const restoreSession = async () => {

      // 1. Try backend first (cloud session — survives refresh & works across devices)
      const cloudSnap = await loadSession();
      if (cloudSnap && (cloudSnap.players?.length || cloudSnap.rounds?.length)) {
        // Always restore players, config, and tournament name if present
        if (cloudSnap.players?.length) setPlayers(cloudSnap.players);
        if (cloudSnap.tournamentName) setTournamentName(cloudSnap.tournamentName);
        if (cloudSnap.teams?.length) setTeams(cloudSnap.teams);
        if (cloudSnap.meta) {
          if (cloudSnap.meta.courts) setCourts(cloudSnap.meta.courts);
          if (cloudSnap.meta.sessionMinutes) setSessionMinutes(cloudSnap.meta.sessionMinutes);
          if (cloudSnap.meta.minutesPerRound) setMinutesPerRound(cloudSnap.meta.minutesPerRound);
          if (cloudSnap.meta.tournamentType) setTournamentType(cloudSnap.meta.tournamentType);
          if (cloudSnap.meta.gameFormat) setGameFormat(cloudSnap.meta.gameFormat);
          if (cloudSnap.meta.matchFormat) setMatchFormat(cloudSnap.meta.matchFormat);
          if (typeof cloudSnap.meta.separateBySkill === 'boolean') setSeparateBySkill(cloudSnap.meta.separateBySkill);
        }
        // Restore round-specific state only when there are actual rounds
        if (cloudSnap.rounds?.length) {
          setRounds(cloudSnap.rounds);
          if (cloudSnap.playerStats) setPlayerStats(cloudSnap.playerStats);
          if (cloudSnap.kotStats) setKotStats(cloudSnap.kotStats);
          if (cloudSnap.teamStats) setTeamStats(cloudSnap.teamStats);
          if (typeof cloudSnap.currentRound === 'number') setCurrentRound(cloudSnap.currentRound);
          if (cloudSnap.locked) setLocked(cloudSnap.locked);
          // Only restore actively-playing courts
          if (cloudSnap.courtStates) {
            const activeCourts = cloudSnap.courtStates.filter(c => c.status === 'playing' && c.currentMatch);
            if (activeCourts.length > 0) setCourtStates(cloudSnap.courtStates);
          }
          setTab('schedule');
          console.log('[Session] Restored session from cloud:', cloudSnap.rounds.length, 'rounds');
        } else {
          console.log('[Session] Restored players/config from cloud (no rounds yet)');
        }
        return; // Cloud wins — skip localStorage
      }

      // 2. Fallback: localStorage (existing behaviour)
      const raw = localStorage.getItem('pb_session');
      if (!raw) return;
      try {
        const snap = JSON.parse(raw);
        if (snap.players?.length || snap.rounds?.length) {
          // Always restore players and config
          if (snap.players?.length) setPlayers(snap.players);
          if (snap.tournamentName) setTournamentName(snap.tournamentName);
          if (snap.teams?.length) setTeams(snap.teams);
          if (snap.meta) {
            if (snap.meta.courts) setCourts(snap.meta.courts);
            if (snap.meta.sessionMinutes) setSessionMinutes(snap.meta.sessionMinutes);
            if (snap.meta.minutesPerRound) setMinutesPerRound(snap.meta.minutesPerRound);
            if (snap.meta.tournamentType) setTournamentType(snap.meta.tournamentType);
            if (snap.meta.gameFormat) setGameFormat(snap.meta.gameFormat);
            if (snap.meta.matchFormat) setMatchFormat(snap.meta.matchFormat);
            if (typeof snap.meta.separateBySkill === 'boolean') setSeparateBySkill(snap.meta.separateBySkill);
          }
          // Restore round state only when rounds exist
          if (snap.rounds?.length) {
            setRounds(snap.rounds);
            if (snap.playerStats) setPlayerStats(snap.playerStats);
            if (snap.kotStats) setKotStats(snap.kotStats);
            if (snap.teamStats) setTeamStats(snap.teamStats);
            if (typeof snap.currentRound === 'number') setCurrentRound(snap.currentRound);
            if (snap.locked) setLocked(snap.locked);
            if (snap.courtStates) setCourtStates(snap.courtStates);
            setTab('schedule');
            console.log('[Session] Restored session from localStorage:', snap.rounds.length, 'rounds');
          } else {
            console.log('[Session] Restored players/config from localStorage (no rounds yet)');
          }
        }
      } catch (e) {
        console.warn('[Session] Failed to restore session from localStorage:', e);
      }
    };
    // Always lift the autosave guard once restore completes (or fails)
    restoreSession().finally(() => { sessionRestoredRef.current = true; });
  }, []); // eslint-disable-line

  // Fetch roster from DB on login — only when session has NOT already restored players
  // (prevents DB fetch from overwriting restored player presence states)
  useEffect(() => {
    const fetchRoster = async () => {
      if (user) {
        try {
          const { success, data } = await api.players.getAll();
          if (success && data.players) {
            const dbPlayers = data.players.map(p => ({
              id: p.id,
              name: p.player_name,
              rating: Number(p.dupr_rating) || 2.5,
              gender: p.gender || 'male',
              present: true
            }));
            // Only overwrite players from DB if the session had no players
            // (avoids resetting presence states set during roll call)
            setPlayers(prev => prev.length === 0 ? dbPlayers : prev);
            localStorage.setItem('migration_completed', 'true');
          }
        } catch (error) {
          console.error('Failed to fetch players', error);
        }
      }
    };
    fetchRoster();
  }, [user]); // eslint-disable-line

  useEffect(() => {
    localStorage.setItem('pb_roster', JSON.stringify(players));
  }, [players]);


  // Sync courtStates whenever the courts count changes.
  // If courtStates is empty → full initialisation.
  // If courts increased beyond current array → append the new courts so they
  //   show up in getPlayersOnCourt and matches can be assigned to them.
  // If courts decreased → trim the excess (only remove courts that have no active match).
  useEffect(() => {
    setCourtStates(prev => {
      if (prev.length === courts) return prev; // nothing to do

      if (prev.length === 0) {
        // Fresh initialisation
        return Array.from({ length: courts }, (_, i) => ({
          courtNumber: i + 1,
          status: 'ready',
          currentMatch: null
        }));
      }

      if (courts > prev.length) {
        // Add the missing courts
        const extras = Array.from({ length: courts - prev.length }, (_, i) => ({
          courtNumber: prev.length + i + 1,
          status: 'ready',
          currentMatch: null
        }));
        return [...prev, ...extras];
      }

      // courts < prev.length — trim only courts with no active match
      return prev
        .filter(c => c.courtNumber <= courts || c.currentMatch !== null)
        .slice(0, Math.max(courts, prev.filter(c => c.currentMatch !== null).length));
    });
  }, [courts]); // eslint-disable-line

  useEffect(() => {
    // Guard 1: don't save before session has been restored (prevents blank-state overwrite on mount)
    if (!sessionRestoredRef.current) return;
    // Guard 2: skip autosave while End & Clear is in progress
    if (isClearingSession.current) return;

    const snapshot = {
      players, rounds, playerStats, kotStats, teamStats, currentRound, teams, courtStates,
      tournamentName,
      meta: { courts, sessionMinutes, minutesPerRound, tournamentType, gameFormat, matchFormat, separateBySkill, ts: Date.now() },
      locked
    };
    localStorage.setItem('pb_session', JSON.stringify(snapshot));
    // Also save to cloud (debounced 3s) so other devices / refreshes pick it up
    if (rounds.length > 0) {
      saveSession({
        ...snapshot,
        tournamentName: tournamentName || 'Active Session',
        tournamentType: tournamentType || 'round_robin',
        numCourts: courts
      });
    }
  }, [players, rounds, playerStats, kotStats, teamStats, currentRound, teams, courtStates, courts, sessionMinutes, minutesPerRound, tournamentType, gameFormat, matchFormat, separateBySkill, locked, tournamentName]); // eslint-disable-line

  useEffect(() => {
    const handler = (e) => {
      if (!rounds.length || exportedThisSession) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [rounds.length, exportedThisSession]);


  const presentPlayers = useMemo(() => players.filter((p) => p.present !== false), [players]);

  // Get players/teams currently playing on courts
  const getPlayersOnCourt = useMemo(() => {
    const playingPlayerIds = new Set();
    courtStates.forEach(court => {
      // Check if match exists, regardless of status (prevents ghost matches)
      if (court.currentMatch) {
        const match = court.currentMatch;
        if (match.gameFormat === 'singles') {
          if (match.player1) playingPlayerIds.add(match.player1.id);
          if (match.player2) playingPlayerIds.add(match.player2.id);
        } else {
          // Doubles or teamed doubles
          match.team1?.forEach(p => playingPlayerIds.add(p.id));
          match.team2?.forEach(p => playingPlayerIds.add(p.id));
        }
      }
    });
    return playingPlayerIds;
  }, [courtStates]);

  const getTeamsOnCourt = useMemo(() => {
    const playingTeamIds = new Set();
    courtStates.forEach(court => {
      // Check if match exists, regardless of status
      if (court.currentMatch) {
        const match = court.currentMatch;
        if (match.team1Id) playingTeamIds.add(match.team1Id);
        if (match.team2Id) playingTeamIds.add(match.team2Id);
      }
    });
    return playingTeamIds;
  }, [courtStates]);

  // Get available players (present and not currently playing)
  const availablePlayers = useMemo(() => {
    return presentPlayers.filter(p => !getPlayersOnCourt.has(p.id));
  }, [presentPlayers, getPlayersOnCourt]);

  // Get available teams (not currently playing)
  const availableTeams = useMemo(() => {
    return teams.filter(t => !getTeamsOnCourt.has(t.id));
  }, [teams, getTeamsOnCourt]);

  // Derive accurate player stats directly from rounds history
  // This is immune to double-counting bugs in the imperative playerStats accumulator
  const derivedPlayerStats = useMemo(() => {
    const stats = {};
    // Count matches played per player — ONLY from completed matches
    rounds.forEach(round => {
      round.forEach(match => {
        if (match.status !== 'completed') return; // skip pending / removed
        const playerIds = [];
        if (match.gameFormat === 'singles') {
          if (match.player1) playerIds.push(match.player1.id);
          if (match.player2) playerIds.push(match.player2.id);
        } else {
          match.team1?.forEach(p => playerIds.push(p.id));
          match.team2?.forEach(p => playerIds.push(p.id));
        }
        playerIds.forEach(id => {
          if (!stats[id]) stats[id] = { matchesPlayed: 0, roundsSatOut: 0 };
          stats[id].matchesPlayed += 1;
        });
      });
    });
    // Derive sat-out: base this on ALL present players, not just those who have played.
    // This prevents benchwarmers from getting mathematically starved if courts drop.
    const presentPlayerIds = presentPlayers.map(p => p.id);
    const everPlayedIds = new Set(Object.keys(stats));
    const trackableIds = new Set([...presentPlayerIds, ...everPlayedIds]);
    rounds.forEach(round => {
      const completedInRound = round.filter(m => m.status === 'completed');
      if (completedInRound.length === 0) return; // skip purely pending/removed rounds
      const playersInRound = new Set();
      completedInRound.forEach(match => {
        if (match.gameFormat === 'singles') {
          if (match.player1) playersInRound.add(match.player1.id);
          if (match.player2) playersInRound.add(match.player2.id);
        } else {
          match.team1?.forEach(p => playersInRound.add(p.id));
          match.team2?.forEach(p => playersInRound.add(p.id));
        }
      });
      trackableIds.forEach(id => {
        if (!stats[id]) stats[id] = { matchesPlayed: 0, roundsSatOut: 0 };
        if (!playersInRound.has(id)) {
          stats[id].roundsSatOut += 1;
        }
      });
    });
    return stats;
  }, [rounds, presentPlayers]);


  // Derive accurate team stats from rounds history (ground-truth, like derivedPlayerStats)
  const derivedTeamStats = useMemo(() => {
    const stats = {};

    // Pass 1: count matches played per team
    const everPlayedTeamIds = new Set();
    rounds.forEach(round => {
      round.forEach(match => {
        if (match.team1Id) {
          if (!stats[match.team1Id]) stats[match.team1Id] = { matchesPlayed: 0, roundsSatOut: 0 };
          stats[match.team1Id].matchesPlayed += 1;
          everPlayedTeamIds.add(match.team1Id);
        }
        if (match.team2Id) {
          if (!stats[match.team2Id]) stats[match.team2Id] = { matchesPlayed: 0, roundsSatOut: 0 };
          stats[match.team2Id].matchesPlayed += 1;
          everPlayedTeamIds.add(match.team2Id);
        }
      });
    });

    // Pass 2: count sat-out rounds for teams that have appeared at least once
    rounds.forEach(round => {
      if (round.length === 0) return;
      const teamsInRound = new Set();
      round.forEach(match => {
        if (match.team1Id) teamsInRound.add(match.team1Id);
        if (match.team2Id) teamsInRound.add(match.team2Id);
      });
      everPlayedTeamIds.forEach(id => {
        if (!stats[id]) stats[id] = { matchesPlayed: 0, roundsSatOut: 0 };
        if (!teamsInRound.has(id)) {
          stats[id].roundsSatOut += 1;
        }
      });
    });

    return stats;
  }, [rounds]);

  // \u2500\u2500 Dev lifecycle watchers (placed after all useMemos so deps are in scope) \u2500\u2500
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    addDebug('PLAYERS', `players \u2192 ${players.length}`, {
      count: players.length,
      names: players.map(p => `${p.name} [present=${p.present}]`)
    });
  }, [players]); // eslint-disable-line

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    addDebug('PRESENT', `presentPlayers \u2192 ${presentPlayers.length}`, {
      count: presentPlayers.length,
      names: presentPlayers.map(p => p.name)
    });
  }, [presentPlayers]); // eslint-disable-line

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    addDebug('ROUND', `rounds \u2192 ${rounds.length} round(s)`, {
      rounds: rounds.map((r, i) => ({
        round: i + 1, matches: r.length,
        completed: r.filter(m => m.status === 'completed').length
      }))
    });
  }, [rounds]); // eslint-disable-line

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    addDebug('COURT', `courtStates changed`, {
      courts: courtStates.map(c => ({ court: c.courtNumber, status: c.status, hasMatch: !!c.currentMatch }))
    });
  }, [courtStates]); // eslint-disable-line

  // Get next-up queue based on fairness
  const getNextUpQueue = useMemo(() => {
    if (tournamentType === 'round_robin') {
      if (gameFormat === 'singles') {
        return availablePlayers
          .map(p => {
            const stats = derivedPlayerStats[p.id] || { matchesPlayed: 0, roundsSatOut: 0 };
            return { ...p, roundsPlayed: stats.matchesPlayed, roundsSatOut: stats.roundsSatOut, priority: stats.roundsSatOut * 100 + (10 - stats.matchesPlayed) };
          })
          .sort((a, b) => b.priority - a.priority);
      } else if (gameFormat === 'teamed_doubles') {
        return availableTeams
          .map(t => {
            const stats = derivedTeamStats[t.id] || { matchesPlayed: 0, roundsSatOut: 0 };
            return { ...t, roundsPlayed: stats.matchesPlayed, roundsSatOut: stats.roundsSatOut, priority: stats.roundsSatOut * 100 + (10 - stats.matchesPlayed) };
          })
          .sort((a, b) => b.priority - a.priority);
      } else {
        // Regular doubles: prioritize players by sat-out rounds, then fewer matches
        return availablePlayers
          .map(p => {
            const stats = derivedPlayerStats[p.id] || { matchesPlayed: 0, roundsSatOut: 0 };
            return { ...p, roundsPlayed: stats.matchesPlayed, roundsSatOut: stats.roundsSatOut, priority: stats.roundsSatOut * 100 + (10 - stats.matchesPlayed) };
          })
          .sort((a, b) => b.priority - a.priority);
      }
    } else if (tournamentType === 'king_of_court') {
      return availablePlayers
        .map(p => {
          const stats = kotStats[p.id] || { roundsPlayed: 0, roundsSatOut: 0, totalPoints: 0 };
          return { ...p, roundsPlayed: stats.roundsPlayed || 0, roundsSatOut: stats.roundsSatOut || 0 };
        })
        .sort((a, b) => b.roundsSatOut - a.roundsSatOut || a.roundsPlayed - b.roundsPlayed);
    }
    return [];
  }, [tournamentType, gameFormat, availablePlayers, availableTeams, derivedPlayerStats, derivedTeamStats, kotStats]);

  const addPlayer = async () => {
    const name = form.name.trim();
    const rating = Number(form.rating);
    if (!name) return alert('Name is required');
    if (Number.isNaN(rating) || rating < 2.0 || rating > 5.5) return alert('Enter DUPR 2.0 – 5.5');

    try {
      // Call API
      const { success, data, error } = await api.players.create({
        player_name: name,
        dupr_rating: rating,
        gender: form.gender
      });

      if (success && data.player) {
        const newPlayer = {
          id: data.player.id,
          name: data.player.player_name,
          rating: Number(data.player.dupr_rating),
          gender: data.player.gender,
          present: true
        };
        setPlayers((prev) => [...prev, newPlayer]);
        setForm({ name: '', rating: '', gender: 'male' });

        setAddNote(`Added ${name} – check Roster`);
        setTimeout(() => setAddNote(null), 2000);
      } else {
        alert(`Failed to add player: ${error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error adding player');
    }
  };

  const removePlayer = async (id) => {
    const player = players.find(p => p.id === id);
    if (rounds.length > 0 && player) {
      const confirmRemove = window.confirm(
        `Remove ${player.name}? Their stats will be preserved for reporting.`
      );
      if (!confirmRemove) return;
    }

    // Call API
    try {
      const { success, error } = await api.players.delete(id);
      if (success) {
        setPlayers((prev) => prev.filter((p) => p.id !== id));
      } else {
        alert(`Failed to delete player: ${error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting player');
    }
  };

  const togglePresent = (id) => {
    const player = players.find(p => p.id === id);
    if (rounds.length > 0 && player) {
      const action = player.present ? 'mark as absent' : 'mark as present';
      const confirmToggle = window.confirm(
        `${action.charAt(0).toUpperCase() + action.slice(1)} ${player.name}? This will affect future rounds.`
      );
      if (!confirmToggle) return;
    }
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, present: !p.present } : p)));
  };

  const updatePlayerField = (id, field, value) =>
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: field === 'rating' ? Number(value) : value } : p)));

  const parseBulk = async () => {
    const lines = bulkText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const add = [];
    const normalizeGender = (g) => {
      if (!g) return 'male';
      const s = g.toString().trim().toLowerCase();
      if (['f', 'female', 'woman', 'w'].includes(s)) return 'female';
      if (['m', 'male', 'man', 'men'].includes(s)) return 'male';
      return 'male';
    };
    for (const line of lines) {
      const [name, ratingStr, gender] = line.split(',').map((s) => (s ?? '').trim());
      const rating = Number(ratingStr);
      if (!name || Number.isNaN(rating)) continue;
      add.push({ name, rating, gender: normalizeGender(gender), present: true });
    }
    if (!add.length) return alert('Nothing to add. Use: Name, Rating, Gender');

    // Attempt to persist to the global roster via API
    try {
      const apiPayload = add.map(p => ({
        player_name: p.name,
        dupr_rating: p.rating,
        gender: p.gender
      }));
      
      const { success, data } = await api.players.bulkCreate(apiPayload);
      
      if (success && data.players) {
        // Use the returned player objects with actual DB IDs
        const dbPlayers = data.players.map(p => ({
          id: p.id,
          name: p.player_name,
          rating: Number(p.dupr_rating),
          gender: p.gender,
          present: true
        }));
        setPlayers((prev) => [...prev, ...dbPlayers]);
      } else {
        // Fallback to local IDs if API fails
        console.warn('Bulk create API failed, proceeding with local players');
        setPlayers((prev) => [...prev, ...add.map(p => ({ ...p, id: uid() }))]);
      }
    } catch (err) {
      console.warn('Bulk create error, proceeding with local players', err);
      setPlayers((prev) => [...prev, ...add.map(p => ({ ...p, id: uid() }))]);
    }
    
    setBulkText('');
  };

  // Court Flow Management Functions
  const assignMatchToCourt = (courtNumber, isManual = false) => {
    // Guard against auto-assignment
    if (!isManual) {
      console.warn(`[Blocked] Automatic match assignment attempted on Court ${courtNumber}. Manual assignment is required.`);
      return;
    }

    console.log(`[Manual] Assigning match to Court ${courtNumber}`);

    // Safety check: Don't assign if there's already a match
    const court = courtStates.find(c => c.courtNumber === courtNumber);
    if (court && court.currentMatch) {
      console.warn(`Court ${courtNumber} already has a match. Cannot assign new match.`);
      return;
    }

    if (tournamentType === 'round_robin') {
      if (gameFormat === 'singles') {
        assignSinglesMatchToCourt(courtNumber);
      } else if (gameFormat === 'teamed_doubles') {
        assignTeamedDoublesMatchToCourt(courtNumber);
      } else {
        assignDoublesMatchToCourt(courtNumber);
      }
    } else if (tournamentType === 'king_of_court') {
      // King of Court requires all courts to complete before generating next round
      // Check if all courts are ready (meaning previous round is complete)
      const allCourtsReady = courtStates.every(c => c.status === 'ready');
      if (allCourtsReady) {
        alert('Use "Generate Next Round" to start a new King of Court cycle. All courts must complete before shuffling players.');
      } else {
        alert('Complete all current matches before starting the next King of Court round.');
      }
    }
  };

  const assignSinglesMatchToCourt = (courtNumber) => {
    if (availablePlayers.length < 2) {
      return alert('Need at least 2 available players (not currently playing)');
    }

    // Sort by priority (players who have played least / sat out most)
    const sortedAvailable = [...availablePlayers].sort((a, b) => {
      const statsA = playerStats[a.id] || { roundsPlayed: 0, roundsSatOut: 0 };
      const statsB = playerStats[b.id] || { roundsPlayed: 0, roundsSatOut: 0 };
      return statsA.roundsPlayed - statsB.roundsPlayed || statsB.roundsSatOut - statsA.roundsSatOut;
    });

    // Pick player 1 (highest priority)
    const player1 = sortedAvailable[0];

    // Enforce same-gender: only consider opponents of the same gender
    const sameGenderCandidates = sortedAvailable.slice(1).filter(p => p.gender === player1.gender);

    if (sameGenderCandidates.length === 0) {
      const genderLabel = player1.gender === 'female' ? 'female' : 'male';
      return alert(
        `Cannot assign singles match: ${player1.name} is ${genderLabel} but there are no other ${genderLabel} players available. ` +
        `Singles matches require same-gender opponents.`
      );
    }

    let player2;

    if (separateBySkill && presentPlayers.length >= 8) {
      // Try to find a skill-compatible same-gender opponent first
      const skillCompatible = sameGenderCandidates.filter(p => canPlayTogether(player1, p));
      if (skillCompatible.length > 0) {
        player2 = skillCompatible[0];
      } else {
        // No skill-compatible same-gender player — use any same-gender player
        console.warn('No skill-compatible same-gender player found for singles, using closest same-gender player');
        player2 = sameGenderCandidates[0];
      }
    } else {
      // No skill separation — pick highest-priority same-gender player
      player2 = sameGenderCandidates[0];
    }

    const match = {
      id: uid(),
      court: courtNumber,
      player1,
      player2,
      diff: Math.abs(player1.rating - player2.rating),
      score1: '',
      score2: '',
      game1Score1: '',
      game1Score2: '',
      game2Score1: '',
      game2Score2: '',
      game3Score1: '',
      game3Score2: '',
      status: 'pending',
      winner: null,
      gameFormat: 'singles',
      matchFormat: matchFormat,
      startTime: new Date().toISOString()
    };

    // Update court state
    setCourtStates(prev => prev.map(c =>
      c.courtNumber === courtNumber
        ? { ...c, status: 'playing', currentMatch: match }
        : c
    ));

    // Immediately add to rounds so score cards appear in history
    setRounds(prev => {
      const newRounds = [...prev];
      if (newRounds.length === 0) {
        newRounds.push([match]);
      } else {
        const lastRound = newRounds[newRounds.length - 1];
        const lastRoundDone = lastRound.every(m => m.status === 'completed');
        if (lastRoundDone) {
          newRounds.push([match]);
        } else {
          newRounds[newRounds.length - 1] = [...lastRound, match];
        }
      }
      return newRounds;
    });
    setCurrentRound(rounds.length > 0 && rounds[rounds.length - 1].every(m => m.status === 'completed') ? rounds.length : currentRound);

    // Initialize player stats if needed
    setPlayerStats(prev => {
      const updated = { ...prev };
      if (!updated[player1.id]) {
        updated[player1.id] = {
          roundsPlayed: 0,
          roundsSatOut: 0,
          lastPlayedRound: -1,
          opponents: {},
          teammates: {},
          totalPlayMinutes: 0
        };
      }
      if (!updated[player2.id]) {
        updated[player2.id] = {
          roundsPlayed: 0,
          roundsSatOut: 0,
          lastPlayedRound: -1,
          opponents: {},
          teammates: {},
          totalPlayMinutes: 0
        };
      }
      return updated;
    });
  };

  const assignDoublesMatchToCourt = (courtNumber) => {
    // Bench guard: need ≥4 sideline players to form a fresh group
    if (availablePlayers.length < 4) {
      const stillPlaying = courtStates.filter(c => c.status === 'playing' && c.courtNumber !== courtNumber).length;
      if (stillPlaying > 0) {
        return alert(
          `Not enough bench players to assign early.\n\n` +
          `There are only ${availablePlayers.length} player(s) sitting out — need at least 4 to form a fresh match.\n\n` +
          `Wait for more courts to finish, then assign.`
        );
      }
      return alert('Need at least 4 available players (not currently playing)');
    }

    let group;

    // Apply skill separation if enabled
    if (separateBySkill && presentPlayers.length >= 8) {
      // Sort by priority (players who have played least)
      const sortedAvailable = [...availablePlayers].sort((a, b) => {
        const statsA = playerStats[a.id] || { roundsPlayed: 0, roundsSatOut: 0 };
        const statsB = playerStats[b.id] || { roundsPlayed: 0, roundsSatOut: 0 };
        return statsA.roundsPlayed - statsB.roundsPlayed || statsB.roundsSatOut - statsA.roundsSatOut;
      });

      // Start with the highest priority player
      const primaryPlayer = sortedAvailable[0];

      // Filter for players who can play with the primary player (within ±1 skill level)
      const compatiblePlayers = sortedAvailable.filter(p => canPlayTogether(primaryPlayer, p));

      if (compatiblePlayers.length >= 4) {
        // Select best group of 4 from skill-compatible players
        group = selectBestGroupOfFour(compatiblePlayers, playerStats);
      } else {
        // Not enough skill-compatible players, fall back to mixed selection
        console.warn('Not enough skill-compatible players for strict separation, using mixed selection');
        group = selectBestGroupOfFour(sortedAvailable, playerStats);
      }
    } else {
      // No skill separation, use traditional selection
      const sortedAvailable = [...availablePlayers].sort((a, b) => {
        const statsA = playerStats[a.id] || { roundsPlayed: 0, roundsSatOut: 0 };
        const statsB = playerStats[b.id] || { roundsPlayed: 0, roundsSatOut: 0 };
        return statsA.roundsPlayed - statsB.roundsPlayed || statsB.roundsSatOut - statsA.roundsSatOut;
      });
      group = selectBestGroupOfFour(sortedAvailable, playerStats);
    }

    const teamSplit = findBestTeamSplit(group, playerStats);
    const t1Names = teamSplit.team1.map(p => p.name).join('/');
    const t2Names = teamSplit.team2.map(p => p.name).join('/');

    const match = {
      id: uid(),
      court: courtNumber,
      team1: teamSplit.team1,
      team2: teamSplit.team2,
      diff: Math.abs(avg(teamSplit.team1) - avg(teamSplit.team2)),
      score1: '',
      score2: '',
      game1Score1: '',
      game1Score2: '',
      game2Score1: '',
      game2Score2: '',
      game3Score1: '',
      game3Score2: '',
      status: 'pending',
      winner: null,
      gameFormat: 'doubles',
      matchFormat: matchFormat,
      startTime: new Date().toISOString()
    };

    // Update court state
    setCourtStates(prev => prev.map(c =>
      c.courtNumber === courtNumber
        ? { ...c, status: 'playing', currentMatch: match }
        : c
    ));

    // ── Round bucketing ────────────────────────────────────────────────────
    // Key distinction:
    //  - "established" round: has >= courts matches (generated by generateNextRound).
    //    Any early assigns while others are still playing go to a NEW round.
    //  - "forming" round: has < courts matches (fresh batch in progress).
    //    Assigns keep appending to the same round.
    const hasOtherCourtsPlaying = courtStates.some(
      c => c.status === 'playing' && c.courtNumber !== courtNumber
    );
    setRounds(prev => {
      const newRounds = [...prev];
      if (newRounds.length === 0) {
        newRounds.push([match]);
      } else {
        const lastRound = newRounds[newRounds.length - 1];
        const lastRoundDone = lastRound.every(m => m.status === 'completed' || m.status === 'removed');
        const lastRoundIsEstablished = lastRound.length >= courts;
        if (lastRoundDone || (lastRoundIsEstablished && hasOtherCourtsPlaying)) {
          // All done (fresh round) OR established round with courts still playing (early assign)
          newRounds.push([match]);
          setCurrentRound(newRounds.length - 1);
        } else {
          // Fresh batch forming (round has < courts matches) — append
          newRounds[newRounds.length - 1] = [...lastRound, match];
        }
      }
      return newRounds;
    });
    setCurrentRound(rounds.length > 0 && rounds[rounds.length - 1].every(m => m.status === 'completed') ? rounds.length : currentRound);

    // Initialize player stats if needed
    setPlayerStats(prev => {
      const updated = { ...prev };
      [...teamSplit.team1, ...teamSplit.team2].forEach(p => {
        if (!updated[p.id]) {
          updated[p.id] = {
            roundsPlayed: 0,
            roundsSatOut: 0,
            lastPlayedRound: -1,
            opponents: {},
            teammates: {},
            totalPlayMinutes: 0
          };
        }
      });
      return updated;
    });
  };

  const assignTeamedDoublesMatchToCourt = (courtNumber) => {
    if (availableTeams.length < 2) {
      return alert('Need at least 2 available teams (not currently playing)');
    }

    // Sort by gender first, then by priority
    const maleTeams = availableTeams.filter(t => t.gender === 'male_male');
    const femaleTeams = availableTeams.filter(t => t.gender === 'female_female');
    const mixedTeams = availableTeams.filter(t => t.gender === 'mixed');

    let selectedTeams, genderType;

    // Try to match within the largest gender group
    if (maleTeams.length >= 2) {
      selectedTeams = maleTeams;
      genderType = 'male_male';
    } else if (femaleTeams.length >= 2) {
      selectedTeams = femaleTeams;
      genderType = 'female_female';
    } else if (mixedTeams.length >= 2) {
      selectedTeams = mixedTeams;
      genderType = 'mixed';
    } else {
      return alert('Need at least 2 teams of the same gender type available');
    }

    // Sort teams by priority (least matches played first)
    const sortedTeams = [...selectedTeams].sort((a, b) => {
      const statsA = teamStats[a.id] || { roundsPlayed: 0, roundsSatOut: 0 };
      const statsB = teamStats[b.id] || { roundsPlayed: 0, roundsSatOut: 0 };
      return statsA.roundsPlayed - statsB.roundsPlayed || statsB.roundsSatOut - statsA.roundsSatOut;
    });

    let team1, team2;

    // If we have many teams, try to find a balanced matchup
    if (sortedTeams.length >= 3) {
      // Start with the highest priority team
      team1 = sortedTeams[0];

      // Find the best opponent for team1 from remaining teams
      const potentialOpponents = sortedTeams.slice(1);

      // Score each potential opponent
      const scoredOpponents = potentialOpponents.map(team => {
        let score = 0;
        const stats1 = teamStats[team1.id] || { opponents: {} };

        // Penalty for rating difference (prefer close ratings)
        const ratingDiff = Math.abs(team1.avgRating - team.avgRating);
        score += ratingDiff * 10;

        // Penalty for repeated matchups
        const timesPlayed = (stats1.opponents || {})[team.id] || 0;
        score += timesPlayed * 20;

        // Small bonus for teams that have played fewer matches overall
        const teamStats2 = teamStats[team.id] || { roundsPlayed: 0 };
        score -= (5 - teamStats2.roundsPlayed) * 2;

        return { team, score };
      });

      // Select opponent with lowest score (best match)
      scoredOpponents.sort((a, b) => a.score - b.score);
      team2 = scoredOpponents[0].team;
    } else {
      // Only 2 teams available, use them
      team1 = sortedTeams[0];
      team2 = sortedTeams[1];
    }

    const t1Name = `${team1.player1.name}/${team1.player2.name}`;
    const t2Name = `${team2.player1.name}/${team2.player2.name}`;

    const match = {
      id: uid(),
      court: courtNumber,
      team1: [team1.player1, team1.player2],
      team2: [team2.player1, team2.player2],
      team1Id: team1.id,
      team2Id: team2.id,
      teamGender: genderType,
      diff: Math.abs(team1.avgRating - team2.avgRating),
      score1: '',
      score2: '',
      game1Score1: '',
      game1Score2: '',
      game2Score1: '',
      game2Score2: '',
      game3Score1: '',
      game3Score2: '',
      status: 'pending',
      winner: null,
      gameFormat: 'teamed_doubles',
      matchFormat: matchFormat,
      startTime: new Date().toISOString()
    };

    // Update court state
    setCourtStates(prev => prev.map(c =>
      c.courtNumber === courtNumber
        ? { ...c, status: 'playing', currentMatch: match }
        : c
    ));

    // Add to rounds: start a new round if the last round is fully completed, otherwise append
    setRounds(prev => {
      const newRounds = [...prev];
      if (newRounds.length === 0) {
        newRounds.push([match]);
      } else {
        const lastRound = newRounds[newRounds.length - 1];
        const lastRoundDone = lastRound.every(m => m.status === 'completed');
        if (lastRoundDone) {
          newRounds.push([match]);
        } else {
          newRounds[newRounds.length - 1] = [...lastRound, match];
        }
      }
      return newRounds;
    });
    setCurrentRound(rounds.length > 0 && rounds[rounds.length - 1].every(m => m.status === 'completed') ? rounds.length : currentRound);

    // Initialize team stats if needed
    setTeamStats(prev => {
      const updated = { ...prev };
      if (!updated[team1.id]) {
        updated[team1.id] = { roundsPlayed: 0, roundsSatOut: 0, lastPlayedRound: -1, opponents: {}, totalPlayMinutes: 0 };
      }
      if (!updated[team2.id]) {
        updated[team2.id] = { roundsPlayed: 0, roundsSatOut: 0, lastPlayedRound: -1, opponents: {}, totalPlayMinutes: 0 };
      }
      return updated;
    });
  };

  const completeCourtMatch = (courtNumber, nextStatus = 'ready') => {
    const court = courtStates.find(c => c.courtNumber === courtNumber);
    if (!court || !court.currentMatch) {
      console.warn(`Cannot complete match on court ${courtNumber} - no match found`);
      return;
    }

    const match = court.currentMatch;
    console.log(`[Complete] Completing match on court ${courtNumber} -> ${nextStatus}:`, match);

    // Free up the court and set next status (atomic update)
    setCourtStates(prev => prev.map(c =>
      c.courtNumber === courtNumber
        ? { ...c, status: nextStatus, currentMatch: null }
        : c
    ));

    // For King of Court, match is already in rounds array, so just update it in place
    // For Round Robin, add match to current round ONLY if not already in rounds
    if (tournamentType === 'king_of_court') {
      // Match is already in the rounds array, no need to add it again
      // The match object reference in rounds is the same, so it's already updated with scores/winner
      console.log('King of Court match completed - already in rounds array');
    } else {
      // Check if the match is already in rounds (e.g., added by generateNextRound)
      // If so, don't add it again - it was already tracked with scores/winner via updateScore/quickWin
      setRounds(prev => {
        const matchAlreadyInRounds = prev.some(round =>
          round.some(m => m.id === match.id)
        );

        if (matchAlreadyInRounds) {
          console.log(`[Complete] Match ${match.id} already in rounds - marking completed`);
          // Stamp status=completed and scores on the match in rounds
          return prev.map(round =>
            round.map(m =>
              m.id === match.id
                ? { ...m, status: 'completed', endTime: m.endTime || new Date().toISOString() }
                : m
            )
          );
        }

        // Manual-assigned match: add to current round for the first time
        console.log(`[Complete] Match ${match.id} NOT in rounds - adding now`);
        const newRounds = [...prev];
        if (newRounds.length === 0 || newRounds.length <= currentRound) {
          // Create new round if needed
          newRounds.push([match]);
        } else {
          // Add to current round
          newRounds[currentRound] = [...newRounds[currentRound], match];
        }
        return newRounds;
      });
    }

    // Skip stat updates for King of Court (handled separately in setWinner)
    if (tournamentType === 'king_of_court') {
      return;
    }

    // Calculate who was sitting out BEFORE this match completed
    // (excluding the players in this match)
    const playersInThisMatch = new Set();
    if (match.gameFormat === 'singles') {
      playersInThisMatch.add(match.player1.id);
      playersInThisMatch.add(match.player2.id);
    } else {
      match.team1?.forEach(p => playersInThisMatch.add(p.id));
      match.team2?.forEach(p => playersInThisMatch.add(p.id));
    }

    // Update player/team stats (Round Robin only)
    if (match.gameFormat === 'singles') {
      setPlayerStats(prev => {
        const updated = { ...prev };

        // Update playing players
        const playTime = match.durationMinutes || 0;

        if (updated[match.player1.id]) {
          updated[match.player1.id] = {
            ...updated[match.player1.id],
            roundsPlayed: updated[match.player1.id].roundsPlayed + 1,
            lastPlayedRound: currentRound,
            totalPlayMinutes: (updated[match.player1.id].totalPlayMinutes || 0) + playTime
          };
        }
        if (updated[match.player2.id]) {
          updated[match.player2.id] = {
            ...updated[match.player2.id],
            roundsPlayed: updated[match.player2.id].roundsPlayed + 1,
            lastPlayedRound: currentRound,
            totalPlayMinutes: (updated[match.player2.id].totalPlayMinutes || 0) + playTime
          };
        }

        // Update sitting-out players (those not in ANY match this round)
        // MOVED TO generateNextRound to prevent multiple increments per round
        /*
        presentPlayers.forEach(p => {
           // ... logic removed ...
        });
        */

        // Note: roundsSatOut is not tracked in continuous play mode
        // It only makes sense for traditional round-based generation
        return updated;
      });
    } else if (match.gameFormat === 'teamed_doubles') {
      const playTime = match.durationMinutes || 0;

      setTeamStats(prev => {
        const updated = { ...prev };

        // Update opponent history
        if (updated[match.team1Id] && updated[match.team2Id]) {
          if (!updated[match.team1Id].opponents || updated[match.team1Id].opponents instanceof Map) updated[match.team1Id].opponents = {};
          if (!updated[match.team2Id].opponents || updated[match.team2Id].opponents instanceof Map) updated[match.team2Id].opponents = {};
          updated[match.team1Id].opponents[match.team2Id] = (updated[match.team1Id].opponents[match.team2Id] || 0) + 1;
          updated[match.team2Id].opponents[match.team1Id] = (updated[match.team2Id].opponents[match.team1Id] || 0) + 1;
        }

        // Update rounds played and play time
        if (updated[match.team1Id]) {
          updated[match.team1Id] = {
            ...updated[match.team1Id],
            roundsPlayed: updated[match.team1Id].roundsPlayed + 1,
            lastPlayedRound: currentRound,
            totalPlayMinutes: (updated[match.team1Id].totalPlayMinutes || 0) + playTime
          };
        }
        if (updated[match.team2Id]) {
          updated[match.team2Id] = {
            ...updated[match.team2Id],
            roundsPlayed: updated[match.team2Id].roundsPlayed + 1,
            lastPlayedRound: currentRound,
            totalPlayMinutes: (updated[match.team2Id].totalPlayMinutes || 0) + playTime
          };
        }
        // Note: roundsSatOut is not tracked in continuous play mode
        // It only makes sense for traditional round-based generation
        return updated;
      });
    } else {
      // Regular doubles
      setPlayerStats(prev => {
        const updated = { ...prev };

        // Update teammate history for team1
        if (match.team1 && match.team1.length === 2) {
          const [p1, p2] = match.team1;
          if (updated[p1.id] && updated[p2.id]) {
            if (!updated[p1.id].teammates || updated[p1.id].teammates instanceof Map) updated[p1.id].teammates = {};
            if (!updated[p2.id].teammates || updated[p2.id].teammates instanceof Map) updated[p2.id].teammates = {};
            updated[p1.id].teammates[p2.id] = (updated[p1.id].teammates[p2.id] || 0) + 1;
            updated[p2.id].teammates[p1.id] = (updated[p2.id].teammates[p1.id] || 0) + 1;
          }
        }

        // Update teammate history for team2
        if (match.team2 && match.team2.length === 2) {
          const [p1, p2] = match.team2;
          if (updated[p1.id] && updated[p2.id]) {
            if (!updated[p1.id].teammates || updated[p1.id].teammates instanceof Map) updated[p1.id].teammates = {};
            if (!updated[p2.id].teammates || updated[p2.id].teammates instanceof Map) updated[p2.id].teammates = {};
            updated[p1.id].teammates[p2.id] = (updated[p1.id].teammates[p2.id] || 0) + 1;
            updated[p2.id].teammates[p1.id] = (updated[p2.id].teammates[p1.id] || 0) + 1;
          }
        }

        // Update rounds played and play time for all players
        const playTime = match.durationMinutes || 0;

        match.team1?.forEach(p => {
          if (updated[p.id]) {
            updated[p.id] = {
              ...updated[p.id],
              roundsPlayed: updated[p.id].roundsPlayed + 1,
              lastPlayedRound: currentRound,
              totalPlayMinutes: (updated[p.id].totalPlayMinutes || 0) + playTime
            };
          }
        });
        match.team2?.forEach(p => {
          if (updated[p.id]) {
            updated[p.id] = {
              ...updated[p.id],
              roundsPlayed: updated[p.id].roundsPlayed + 1,
              lastPlayedRound: currentRound,
              totalPlayMinutes: (updated[p.id].totalPlayMinutes || 0) + playTime
            };
          }
        });

        // Update sitting-out players
        // MOVED TO generateNextRound to prevent multiple increments per round
        /*
        presentPlayers.forEach(p => {
          // ... logic removed ...
        });
        */

        // Note: roundsSatOut is not tracked in continuous play mode
        // It only makes sense for traditional round-based generation
        return updated;
      });
    }
  };

  const updateCourtStatus = (courtNumber, status) => {
    setCourtStates(prev => prev.map(c =>
      c.courtNumber === courtNumber
        ? { ...c, status }
        : c
    ));
  };

  // Undo the most recently completed OR removed match
  const undoLastMatch = () => {
    if (!window.confirm('Undo the last match action? This will revert scores and put the match back on its court.')) return;

    // Find the most recently *actioned* match across all rounds by endTime
    let targetMatch = null;
    let targetRoundIdx = -1;
    let targetMatchIdx = -1;

    for (let r = rounds.length - 1; r >= 0; r--) {
      for (let m = rounds[r].length - 1; m >= 0; m--) {
        const match = rounds[r][m];
        if (match.status !== 'completed' && match.status !== 'removed') continue;
        if (
          !targetMatch ||
          new Date(match.endTime) > new Date(targetMatch.endTime)
        ) {
          targetMatch = match;
          targetRoundIdx = r;
          targetMatchIdx = m;
        }
      }
    }

    if (!targetMatch) return alert('No completed or removed matches to undo.');

    // Revert the match back to pending
    const revertedMatch = {
      ...targetMatch,
      status: 'pending',
      winner: null,
      score1: '',
      score2: '',
      game1Score1: '',
      game1Score2: '',
      game2Score1: '',
      game2Score2: '',
      game3Score1: '',
      game3Score2: '',
      endTime: null,
      durationMinutes: null
    };

    // Restore in rounds
    setRounds(prev => {
      const updated = prev.map(r => [...r]);
      updated[targetRoundIdx][targetMatchIdx] = revertedMatch;
      return updated;
    });

    // Put the match back on its court as 'playing'
    setCourtStates(prev => prev.map(c =>
      c.courtNumber === revertedMatch.court
        ? { ...c, status: 'playing', currentMatch: revertedMatch }
        : c
    ));

    // Decrement roundsPlayed for each player in the match
    setPlayerStats(prev => {
      const updated = { ...prev };
      const playerIds = revertedMatch.gameFormat === 'singles'
        ? [revertedMatch.player1?.id, revertedMatch.player2?.id].filter(Boolean)
        : [...(revertedMatch.team1 || []), ...(revertedMatch.team2 || [])].map(p => p.id);
      playerIds.forEach(id => {
        if (updated[id]) {
          updated[id] = {
            ...updated[id],
            roundsPlayed: Math.max(0, (updated[id].roundsPlayed || 1) - 1)
          };
        }
      });
      return updated;
    });
  };

  const generateNextRound = () => {
    try {
      console.log('generateNextRound called');
      let newRound;

      // Safety check for matchFormat
      // Validate matchFormat is present
      const effectiveMatchFormat = matchFormat;
      if (typeof effectiveMatchFormat === 'undefined') {
        throw new Error('Match format is missing. Please return to Setup and select a Match Format.');
      }
      console.log('Generating round with format:', effectiveMatchFormat);
      console.log('Generating round with format:', effectiveMatchFormat);

      if (tournamentType === 'round_robin') {
        // Check game format
        if (gameFormat === 'singles') {
          if (presentPlayers.length < 2) return alert('Need at least 2 present players for singles');
          // Build merged stats: use derivedPlayerStats for accurate played/satOut counts,
          // keep playerStats for opponent history (which derivedPlayerStats doesn't track).
          const singlesStats = {};
          presentPlayers.forEach(p => {
            const base = playerStats[p.id] || { roundsPlayed: 0, roundsSatOut: 0, lastPlayedRound: -1, opponents: {} };
            const derived = derivedPlayerStats[p.id] || { matchesPlayed: 0, roundsSatOut: 0 };
            singlesStats[p.id] = {
              ...base,
              opponents: (base.opponents && !(base.opponents instanceof Map)) ? base.opponents : {},
              roundsPlayed: derived.matchesPlayed,
              roundsSatOut: derived.roundsSatOut,
            };
          });
          newRound = generateSinglesRound(presentPlayers, courts, singlesStats, currentRound, effectiveMatchFormat);
        } else if (gameFormat === 'teamed_doubles') {
          if (teams.length < 2) return alert('Need at least 2 teams for teamed doubles');
          // Build merged stats: use derivedTeamStats for accurate played/satOut counts,
          // keep teamStats for opponent history. Opponents are plain objects (JSON-safe).
          const teamSchedulingStats = {};
          teams.forEach(t => {
            const base = teamStats[t.id] || { roundsPlayed: 0, roundsSatOut: 0, lastPlayedRound: -1, opponents: {} };
            const derived = derivedTeamStats[t.id] || { matchesPlayed: 0, roundsSatOut: 0 };
            teamSchedulingStats[t.id] = {
              ...base,
              opponents: (base.opponents && !(base.opponents instanceof Map)) ? base.opponents : {},
              roundsPlayed: derived.matchesPlayed,   // accurate ground-truth played count
              roundsSatOut: derived.roundsSatOut,     // accurate ground-truth sat-out count
            };
          });
          newRound = generateTeamedDoublesRound(teams, courts, teamSchedulingStats, currentRound, effectiveMatchFormat);
        } else {
          // Regular doubles with random pairing
          if (presentPlayers.length < 4) return alert('Need at least 4 present players');
          // Build merged stats: use derivedPlayerStats for accurate played/satOut counts,
          // keep playerStats for teammate/opponent history. All plain objects — JSON-safe.
          const schedulingStats = {};
          presentPlayers.forEach(p => {
            const base = playerStats[p.id] || { roundsPlayed: 0, roundsSatOut: 0, lastPlayedRound: -1, opponents: {}, teammates: {} };
            const derived = derivedPlayerStats[p.id] || { matchesPlayed: 0, roundsSatOut: 0 };
            schedulingStats[p.id] = {
              ...base,
              opponents: (base.opponents && !(base.opponents instanceof Map)) ? base.opponents : {},
              teammates: (base.teammates && !(base.teammates instanceof Map)) ? base.teammates : {},
              roundsPlayed: derived.matchesPlayed,
              roundsSatOut: derived.roundsSatOut,
            };
          });
          newRound = generateRoundRobinRound(presentPlayers, courts, schedulingStats, currentRound, separateBySkill, effectiveMatchFormat, preferMixedDoubles, femaleRestInterval, rounds);
        }

        if (!newRound || newRound.length === 0) {
          if (gameFormat === 'singles') {
            alert('Could not generate any singles matches. Make sure you have at least 2 present players of the same gender (male-male or female-female).');
          } else {
            alert('Could not generate any matches. Check that you have enough present players and courts configured.');
          }
          return;
        }

        if (newRound && newRound.length > 0) {
          // Auto-assign Round Robin matches to courts
          setCourtStates(prev => {
            const updated = prev.map(c => ({ ...c })); // Deep copy to be safe
            newRound.forEach((match) => {
              let courtIdx = updated.findIndex(c => c.courtNumber === match.court);
              if (courtIdx === -1) {
                // This court doesn't exist in courtStates yet (e.g. courts were
                // increased but courtStates wasn't synced in time). Create it.
                updated.push({
                  courtNumber: match.court,
                  status: 'ready',
                  currentMatch: null
                });
                courtIdx = updated.length - 1;
              }
              updated[courtIdx] = {
                ...updated[courtIdx],
                status: 'playing',
                currentMatch: match
              };
            });
            return updated;
          });

          // Update roundsSatOut for players NOT in this round
          const playersInRound = new Set();
          newRound.forEach(m => {
            if (m.gameFormat === 'singles') {
              if (m.player1) playersInRound.add(m.player1.id);
              if (m.player2) playersInRound.add(m.player2.id);
            } else {
              // Doubles
              m.team1?.forEach(p => playersInRound.add(p.id));
              m.team2?.forEach(p => playersInRound.add(p.id));
            }
          });

          if (gameFormat === 'teamed_doubles') {
            // NOTE: roundsSatOut is already incremented inside generateTeamedDoublesRound
            // (via updateTeamStatsForRound). We must NOT increment again here or sit-outs
            // will be double-counted (one increment from the scheduler + one from here = 2x per round).
            // Nothing to do for teamed_doubles — the scheduler handles it.
          } else {
            setPlayerStats(prev => {
              const updated = { ...prev };
              presentPlayers.forEach(p => {
                // Auto-initialise entry if not present (e.g. round 1 when state starts empty)
                if (!updated[p.id]) {
                  updated[p.id] = { roundsPlayed: 0, roundsSatOut: 0, lastPlayedRound: -1 };
                }
                if (!playersInRound.has(p.id)) {
                  // Player sat out this round — increment their cumulative sat-out count
                  updated[p.id] = {
                    ...updated[p.id],
                    roundsSatOut: (updated[p.id].roundsSatOut || 0) + 1
                  };
                }
                // NOTE: Do NOT reset roundsSatOut to 0 when player plays.
                // Historically resetting caused players who sat out frequently to lose their
                // priority the moment they finally got to play, leading to repeated sit-outs.
                // The cumulative total is used for scheduling priority.
              });
              return updated;
            });
          }

        } else {
          return alert('Unable to generate balanced matches with current players. Try clearing constraints.');
        }
      } else if (tournamentType === 'king_of_court') {
        if (presentPlayers.length < 4) return alert('Need at least 4 present players');

        // Check if all courts are ready
        const allCourtsReady = courtStates.every(c => c.status === 'ready');
        if (!allCourtsReady) {
          return alert('Complete all current matches before generating the next King of Court round.');
        }

        newRound = generateKingOfCourtRound(presentPlayers, courts, kotStats, currentRound, rounds, separateBySkill);

        // Assign King of Court matches to courts immediately
        setCourtStates(prev => {
          const updated = [...prev];
          newRound.forEach((match) => {
            let courtIdx = updated.findIndex(c => c.courtNumber === match.court);
            if (courtIdx === -1) {
              // Court missing from courtStates — create it
              updated.push({ courtNumber: match.court, status: 'ready', currentMatch: null });
              courtIdx = updated.length - 1;
            }
            updated[courtIdx] = {
              ...updated[courtIdx],
              status: 'playing',
              currentMatch: match
            };
          });
          return updated;
        });
        if (gameFormat === 'teamed_doubles') {
          if (teams.length < 2) return alert('Need at least 2 teams for King of Court');
          newRound = generateKingOfCourtTeamedRound(teams, courts, kotTeamStats, currentRound, rounds, separateBySkill);
        } else {
          // Doubles with fixed partnerships (auto-generated on first round)
          if (presentPlayers.length < 4) return alert('Need at least 4 present players');

          // If first round, generate balanced teams
          if (currentRound === 0 && kotAutoTeams.length === 0) {
            const autoTeams = generateBalancedKOTTeams(presentPlayers);
            if (autoTeams.length < 2) {
              return alert('Need at least 4 players (2 teams) for King of Court');
            }
            setKotAutoTeams(autoTeams);
            console.log(`Generated ${autoTeams.length} balanced teams for King of Court:`,
              autoTeams.map(t => `${t.player1.name}/${t.player2.name} (${t.avgRating.toFixed(1)})`));

            // Generate first round with these teams
            newRound = generateKingOfCourtTeamedRound(autoTeams, courts, kotTeamStats, currentRound, rounds, separateBySkill);
          } else {
            // Use existing auto-generated teams
            if (kotAutoTeams.length < 2) {
              return alert('King of Court teams not found. Please restart the tournament.');
            }
            newRound = generateKingOfCourtTeamedRound(kotAutoTeams, courts, kotTeamStats, currentRound, rounds, separateBySkill);
          }
        }
      } else {
        return alert('Invalid tournament type');
      }

      setRounds(prev => [...prev, newRound]);
      setCurrentRound(prev => prev + 1);
      setLocked(true);
      setTab('schedule');
    } catch (error) {
      console.error("Error generating next round:", error);
      alert(`Error generating round: ${error.message}`);
    }
  };

  const clearAllRounds = () => {
    const confirmClear = window.confirm(
      'Clear all rounds and statistics? This cannot be undone.'
    );
    if (!confirmClear) return;

    setRounds([]);
    setCurrentRound(0);
    setPlayerStats({});
    setKotStats({});
    setKotTeamStats({});
    setKotAutoTeams([]);
    setTeamStats({});
    setLocked(false);
    // Clear from cloud so a refresh or other device starts fresh
    clearSession();
    localStorage.removeItem('pb_session');
  };

  const updateScore = (rIdx, mIdx, which, raw) => {
    setRounds((prev) =>
      prev.map((round, i) =>
        i === rIdx
          ? round.map((m, j) => {
            if (j !== mIdx) return m;
            if (raw === '') return { ...m, [which]: '' };
            const n = Number(raw);
            return { ...m, [which]: Number.isNaN(n) ? '' : Math.max(0, n) };
          })
          : round
      )
    );
  };



  const setWinner = (m, side) => {
    m.winner = side === 1 ? 'team1' : 'team2';
    m.status = 'completed';
    m.endTime = new Date().toISOString();

    // Calculate match duration in minutes
    if (m.startTime && m.endTime) {
      const start = new Date(m.startTime);
      const end = new Date(m.endTime);
      m.durationMinutes = Math.round((end - start) / 1000 / 60); // Convert ms to minutes
    }

    if (tournamentType === 'king_of_court' && m.pointsForWin) {
      if (m.gameFormat === 'teamed_doubles') {
        updateKOTTeamStats(kotTeamStats, m);
        setKotTeamStats({ ...kotTeamStats });
      } else {
        updateKOTStats(kotStats, m);
        setKotStats({ ...kotStats });
      }
    }
  };

  const quickWin = (rIdx, mIdx, side) => {
    // Read court number before setRounds so we can clear the court state after
    const courtNumForMatch = rounds[rIdx]?.[mIdx]?.court;

    setRounds((prev) => {
      const newRounds = prev.map((r) => r.map((m) => ({ ...m })));
      const m = newRounds[rIdx][mIdx];

      // Best of 3 format - require all game scores to be entered manually
      if (m.matchFormat === 'best_of_3') {
        // Check if Game 1 and Game 2 scores are entered (accept 0 as a valid score)
        const g1s1 = m.game1Score1 === '' ? null : Number(m.game1Score1);
        const g1s2 = m.game1Score2 === '' ? null : Number(m.game1Score2);
        const g2s1 = m.game2Score1 === '' ? null : Number(m.game2Score1);
        const g2s2 = m.game2Score2 === '' ? null : Number(m.game2Score2);

        if (g1s1 === null || g1s2 === null || g2s1 === null || g2s2 === null) {
          alert('Please enter scores for Game 1 and Game 2 before selecting a winner.');
          return prev;
        }

        // Calculate games won by each team from Game 1 and Game 2
        let team1Games = 0;
        let team2Games = 0;

        if (g1s1 > g1s2) team1Games++;
        else if (g1s2 > g1s1) team2Games++;
        else {
          alert('Game 1 cannot be tied. Please enter valid scores.');
          return prev;
        }

        if (g2s1 > g2s2) team1Games++;
        else if (g2s2 > g2s1) team2Games++;
        else {
          alert('Game 2 cannot be tied. Please enter valid scores.');
          return prev;
        }

        // Check if Game 3 is needed (1-1 split) or not (2-0)
        if (team1Games === 2 || team2Games === 2) {
          // 2-0 win — leave Game 3 scores as-is (don't erase anything entered)
          // Determine actual winner from scores
          const actualWinner = team1Games === 2 ? 1 : 2;

          // Validate selected winner matches actual scores
          if (actualWinner !== side) {
            const winnerName = actualWinner === 1 ? 'Team 1' : 'Team 2';
            alert(`Score validation failed: The scores indicate ${winnerName} won 2-0. Please verify the scores or select the correct winner.`);
            return prev;
          }

          setWinner(m, side);
          return newRounds;
        } else if (team1Games === 1 && team2Games === 1) {
          // 1-1 split - Game 3 IS required
          const g3s1 = Number(m.game3Score1);
          const g3s2 = Number(m.game3Score2);

          if (!g3s1 || !g3s2) {
            alert('Match is tied 1-1. Please enter Game 3 scores before selecting a winner.');
            return prev;
          }

          if (g3s1 === g3s2) {
            alert('Game 3 cannot be tied. Please enter valid scores.');
            return prev;
          }

          // Count Game 3 winner
          if (g3s1 > g3s2) team1Games++;
          else if (g3s2 > g3s1) team2Games++;

          // Determine actual winner from all 3 games
          const actualWinner = team1Games > team2Games ? 1 : 2;

          // Validate selected winner matches actual scores
          if (actualWinner !== side) {
            const winnerName = actualWinner === 1 ? 'Team 1' : 'Team 2';
            const scoreDisplay = actualWinner === 1 ? `${team1Games}-${team2Games}` : `${team2Games}-${team1Games}`;
            alert(`Score validation failed: The scores indicate ${winnerName} won ${scoreDisplay}. Please verify the scores or select the correct winner.`);
            return prev;
          }

          setWinner(m, side);
          return newRounds;
        }

        alert('Cannot determine match outcome. Please check the entered scores.');
        return prev;
      }

      // Single match format — require score to be entered manually (0 is a valid score)
      const s1 = m.score1 === '' ? null : Number(m.score1);
      const s2 = m.score2 === '' ? null : Number(m.score2);

      if (s1 === null || s2 === null) {
        alert('Please enter scores before selecting a winner.');
        return prev;
      }

      if (s1 === s2) {
        alert('Scores cannot be tied. Please enter valid scores.');
        return prev;
      }

      // Validate selected winner matches actual scores
      const actualWinner = s1 > s2 ? 1 : 2;
      if (actualWinner !== side) {
        const winnerName = actualWinner === 1 ? 'Team 1' : 'Team 2';
        alert(`Score validation failed: The score ${s1}-${s2} indicates ${winnerName} won. Please verify the scores or select the correct winner.`);
        return prev;
      }

      setWinner(m, side);
      return newRounds;
    });

    // Clear the court strip — same as completeCourtMatch but without re-stamping rounds
    if (courtNumForMatch) {
      setCourtStates(prev => prev.map(c =>
        c.courtNumber === courtNumForMatch
          ? { ...c, status: 'ready', currentMatch: null }
          : c
      ));
    }
  };

  const getPlayerStatsDisplay = () => {
    if (tournamentType === 'king_of_court') {
      if (gameFormat === 'teamed_doubles') {
        // Show team stats for King of Court with teams
        if (Object.keys(kotTeamStats).length === 0) return null;

        const stats = teams.map(team => {
          const stat = kotTeamStats[team.id] || { totalPoints: 0, court1Wins: 0, currentCourt: null, roundsPlayed: 0 };
          return {
            ...team,
            totalPoints: stat.totalPoints,
            court1Wins: stat.court1Wins,
            currentCourt: stat.currentCourt,
            roundsPlayed: stat.roundsPlayed,
            isTeam: true
          };
        }).sort((a, b) => b.totalPoints - a.totalPoints || b.court1Wins - a.court1Wins);

        return stats;
      } else {
        // Show team stats for King of Court with auto-generated fixed doubles teams
        if (Object.keys(kotTeamStats).length === 0) return null;

        const stats = kotAutoTeams.map(team => {
          const stat = kotTeamStats[team.id] || { totalPoints: 0, court1Wins: 0, currentCourt: null, roundsPlayed: 0 };
          return {
            ...team,
            totalPoints: stat.totalPoints,
            court1Wins: stat.court1Wins,
            currentCourt: stat.currentCourt,
            roundsPlayed: stat.roundsPlayed,
            isTeam: true
          };
        }).sort((a, b) => b.totalPoints - a.totalPoints || b.court1Wins - a.court1Wins);

        return stats;
      }
    } else if (gameFormat === 'teamed_doubles') {
      // Round-robin teamed doubles: use derivedTeamStats (computed from rounds history)
      // to avoid double-counting from the scheduler's in-place mutation of teamStats.
      if (rounds.length === 0) return null;

      const presentIds = new Set(presentPlayers.map(p => p.id));

      const stats = teams.map(team => {
        // Use derivedTeamStats as ground truth for played/satOut, fall back to 0
        const stat = derivedTeamStats[team.id] || { matchesPlayed: 0, roundsSatOut: 0 };
        return {
          ...team,
          isTeam: true,
          roundsPlayed: stat.matchesPlayed || 0,
          roundsSatOut: stat.roundsSatOut || 0,
          totalRounds: (stat.matchesPlayed || 0) + (stat.roundsSatOut || 0),
          // A team is present if both players are still checked in
          present: presentIds.has(team.player1?.id) && presentIds.has(team.player2?.id),
        };
      }).sort((a, b) => a.roundsSatOut - b.roundsSatOut || b.roundsPlayed - a.roundsPlayed);

      return stats;
    } else {
      if (Object.keys(derivedPlayerStats).length === 0 && rounds.length === 0) return null;

      // Build union of: players who appeared in completed matches + currently present players
      // This ensures stats always show even if present flags were reset
      const playerMap = {};
      // First seed from match history (everyone who ever played)
      rounds.forEach(round => {
        round.forEach(match => {
          if (match.status !== 'completed') return;
          const allP = match.gameFormat === 'singles'
            ? [match.player1, match.player2].filter(Boolean)
            : [...(match.team1 || []), ...(match.team2 || [])];
          allP.forEach(p => { if (p && !playerMap[p.id]) playerMap[p.id] = p; });
        });
      });
      // Then add currently present players (may be new faces not yet in a match)
      presentPlayers.forEach(p => { if (!playerMap[p.id]) playerMap[p.id] = p; });

      const stats = Object.values(playerMap).map(player => {
        const stat = derivedPlayerStats[player.id] || { matchesPlayed: 0, roundsSatOut: 0 };
        return {
          ...player,
          roundsPlayed: stat.matchesPlayed,
          roundsSatOut: stat.roundsSatOut,
          totalRounds: stat.matchesPlayed + stat.roundsSatOut
        };
      }).sort((a, b) => a.roundsSatOut - b.roundsSatOut || b.roundsPlayed - a.roundsPlayed);

      return stats;
    }
  };

  return (
    <div className="min-h-screen bg-brand-light pb-40">
      {addNote && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[120] bg-brand-secondary text-brand-primary px-3 py-2 rounded-xl shadow">
          {addNote}
        </div>
      )}

      {/* ── Condensed sticky header ── */}
      <div className="sticky top-0 z-30 backdrop-blur bg-brand-white/90 border-b border-brand-gray">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-primary text-white font-bold text-sm tracking-tight">
              <span><span className="text-white">D</span><span className="text-brand-secondary">S</span></span>
            </div>
            <div>
              <div className="text-sm font-bold text-brand-primary leading-tight">
                {tournamentName || 'DinkSync'}
              </div>
              <div className="text-[10px] text-brand-primary/50 leading-none">
                Round {currentRound} · {presentPlayers.length} players · {courts} courts
              </div>
            </div>
          </div>
          {/* Right-side: pills (desktop) + always-visible ? help button */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px]">
              <span className="rounded-full bg-brand-secondary/20 px-2.5 py-0.5 text-brand-primary font-semibold">
                {presentPlayers.length} present
              </span>
              <span className="rounded-full bg-brand-gray px-2.5 py-0.5 text-brand-primary">
                Rd {currentRound}
              </span>
            </div>
            <button
              onClick={() => setHelpOpen(true)}
              className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-brand-gray text-brand-primary/60 hover:border-brand-primary hover:text-brand-primary font-bold text-sm transition-colors"
              aria-label="Help"
            >
              ?
            </button>
          </div>
        </div>
      </div>

      {/* ── Page content ── */}
      <div className="mx-auto max-w-7xl px-3 sm:px-4 pt-4 sm:pt-6 space-y-4 sm:space-y-6">
        {tab === 'setup' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <Card>
              <h3 className="text-sm font-semibold text-brand-primary mb-2 sm:mb-3">Session</h3>
              <div className="space-y-3">
                <Field label="Tournament name">
                  <input
                    type="text"
                    placeholder="e.g. Friday Night Pickleball"
                    value={tournamentName}
                    onChange={(e) => setTournamentName(e.target.value)}
                    className="w-full h-11 rounded-lg border border-brand-gray px-3 focus:border-brand-secondary focus:ring-brand-secondary"
                  />
                </Field>
                <Field label="Courts">
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={courts}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Allow empty string during editing
                      if (val === '') {
                        setCourts('');
                      } else {
                        const numVal = Number(val);
                        if (!isNaN(numVal)) {
                          setCourts(Math.max(1, Math.min(12, numVal)));
                        }
                      }
                    }}
                    onBlur={(e) => {
                      // Enforce minimum value when user leaves the field
                      if (e.target.value === '' || Number(e.target.value) < 1) {
                        setCourts(1);
                      }
                    }}
                    className="w-full h-11 rounded-lg border border-brand-gray px-3 focus:border-brand-secondary focus:ring-brand-secondary"
                  />
                </Field>
                <Field label="Tournament style">
                  <select
                    value={tournamentType}
                    onChange={(e) => {
                      const newVal = e.target.value;
                      console.log('SETTING CHANGE: Tournament Type ->', newVal);
                      if (rounds.length > 0) {
                        if (!window.confirm('Changing tournament type will clear all rounds. Continue?')) return;
                        clearAllRounds();
                      }
                      setTournamentType(newVal);
                    }}
                    className="w-full h-11 rounded-lg border border-brand-gray px-3 focus:border-brand-secondary focus:ring-brand-secondary"
                  >
                    <option value="round_robin">Round Robin</option>
                    {ENABLE_KOT_V2 && <option value="king_of_court">King of Court</option>}
                  </select>
                </Field>

                <Field label="Game format">
                  <select
                    value={gameFormat}
                    onChange={(e) => {
                      const newVal = e.target.value;
                      console.log('SETTING CHANGE: Game Format ->', newVal);
                      if (rounds.length > 0) {
                        if (!window.confirm('Changing game format will clear all rounds. Continue?')) return;
                        clearAllRounds();
                      }
                      if (newVal !== 'teamed_doubles') {
                        setTeams([]);
                        setTeamBuilderSelected(null);
                      }
                      setGameFormat(newVal);
                    }}
                    className="w-full h-11 rounded-lg border border-brand-gray px-3 focus:border-brand-secondary focus:ring-brand-secondary"
                  >
                    <option value="doubles">Doubles (Random Pairing)</option>
                    <option value="teamed_doubles">Teamed Doubles (Pre-formed Teams)</option>
                    {tournamentType === 'round_robin' && <option value="singles">Singles (1v1)</option>}
                  </select>
                </Field>



                {tournamentType === 'round_robin' && (
                  <Field label="Match format">
                    <select
                      value={matchFormat}
                      onChange={(e) => {
                        const newVal = e.target.value;
                        console.log('SETTING CHANGE: Match Format ->', newVal);
                        setMatchFormat(newVal);
                      }}
                      className="w-full h-11 rounded-lg border border-brand-gray px-3 focus:border-brand-secondary focus:ring-brand-secondary"
                    >
                      <option value="single_match">1 Match per Round</option>
                      <option value="best_of_3">Best of 3</option>
                    </select>
                  </Field>
                )}

                <Field label="Skill separation">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={separateBySkill}
                      onChange={(e) => {
                        console.log('SETTING CHANGE: Separate by Skill ->', e.target.checked);
                        setSeparateBySkill(e.target.checked);
                      }}
                    />
                    <span className="text-sm">Separate by skill levels</span>
                  </label>
                  <div className="mt-2 text-xs text-brand-primary/70">
                    {tournamentType === 'king_of_court' ? (
                      <p className="italic">Creates separate King hierarchies per skill group</p>
                    ) : (
                      <p className="italic">Players auto-balance across skill groups</p>
                    )}
                  </div>
                </Field>

                {/* Mixed Doubles Preferences — only for regular doubles */}
                {gameFormat === 'doubles' && (
                  <>
                    <Field label="Mixed doubles">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={preferMixedDoubles}
                          onChange={(e) => setPreferMixedDoubles(e.target.checked)}
                        />
                        <span className="text-sm">Prefer mixed (M+W) team pairings</span>
                      </label>
                      <div className="mt-2 text-xs text-brand-primary/70">
                        <p className="italic">Women fill courts first, teams split as M+W when possible</p>
                      </div>
                    </Field>

                    {preferMixedDoubles && (
                      <Field label="Female rest interval" hint="After this many rounds in a row, women are soft-rested (prefer to sit out next round if enough players available)">
                        <select
                          value={femaleRestInterval}
                          onChange={(e) => setFemaleRestInterval(Number(e.target.value))}
                          className="w-full h-11 rounded-lg border border-brand-gray px-3 focus:border-brand-secondary focus:ring-brand-secondary"
                        >
                          <option value={1}>Rest after 1 round (most rest)</option>
                          <option value={2}>Rest after 2 rounds (recommended)</option>
                          <option value={3}>Rest after 3 rounds</option>
                          <option value={4}>Rest after 4 rounds (least rest)</option>
                        </select>
                      </Field>
                    )}
                  </>
                )}
              </div>
              {rounds.length > 0 && tournamentType === 'round_robin' && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-xs text-blue-800">
                    ✓ <strong>Late arrivals/departures handled automatically</strong><br />
                    ✓ <strong>Late arrivals/departures handled automatically</strong><br />
                    Simply check/uncheck "Present" in the Roster tab and generate the next round!
                  </div>
                </div>
              )}

              {rounds.length > 0 && tournamentType === 'king_of_court' && (
                <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="text-xs text-purple-800">
                    👑 <strong>King of Court Active!</strong><br />
                    Winners advance up courts, losers drop down. Court 1 = King Court!
                  </div>
                </div>
              )}

              {tournamentType === 'king_of_court' && gameFormat === 'doubles' && kotAutoTeams.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-xs text-blue-800 font-semibold mb-2">
                    🤝 Fixed Partnerships for King of Court
                  </div>
                  <div className="text-xs text-blue-700 space-y-1">
                    {kotAutoTeams.map((team, idx) => (
                      <div key={team.id} className="flex items-center justify-between">
                        <span>
                          <strong>Team {idx + 1}:</strong> {team.player1.name} ({team.player1.rating}) / {team.player2.name} ({team.player2.rating})
                        </span>
                        <span className="font-semibold">Avg: {team.avgRating.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-blue-600 italic">
                    These partnerships will remain fixed throughout the tournament
                  </div>
                </div>
              )}
            </Card>

            {user?.registrationSlug && (
              <Card className="md:col-span-2 mb-4 border-brand-secondary/40 bg-brand-secondary/5">
                <h3 className="text-sm font-semibold text-brand-primary mb-2">Public Registration Link</h3>
                <p className="text-xs text-brand-primary/70 mb-3 block">
                  Share this link with players so they can register for your events automatically.
                </p>
                <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-brand-gray/50">
                  <input
                    type="text"
                    readOnly
                    className="flex-1 bg-transparent border-none text-sm text-brand-primary outline-none px-2"
                    value={`https://dinksync.app/join/${user.registrationSlug}`}
                 />
                 <Button
                   className="bg-brand-secondary text-brand-primary h-8 px-3 text-xs"
                   onClick={(e) => {
                     navigator.clipboard.writeText(`https://dinksync.app/join/${user.registrationSlug}`);
                     e.target.innerText = 'Copied!';
                     setTimeout(() => e.target.innerText = 'Copy', 2000);
                   }}
                 >
                   Copy
                 </Button>
                </div>
              </Card>
            )}

            <Card className="md:col-span-2">
              <h3 className="text-sm font-semibold text-brand-primary mb-2 sm:mb-3">Add players</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-3">
                <input
                  placeholder="Name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="h-11 rounded-lg border border-brand-gray px-3 focus:border-brand-secondary focus:ring-brand-secondary"
                />
                <input
                  type="number"
                  step="0.1"
                  min="2.0"
                  max="5.5"
                  placeholder="DUPR"
                  value={form.rating}
                  onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
                  className="h-11 rounded-lg border border-brand-gray px-3 focus:border-brand-secondary focus:ring-brand-secondary"
                />
                <select
                  value={form.gender}
                  onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                  className="h-11 rounded-lg border border-brand-gray px-3 focus:border-brand-secondary focus:ring-brand-secondary"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <Button className="bg-brand-secondary text-brand-primary hover:bg-brand-secondary/80 w-full" onClick={addPlayer}>
                  Add player
                </Button>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-brand-primary/80">
                  Add multiple players at once <em>(one per line: Name, Rating, Gender)</em>
                </summary>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <textarea
                    rows={6}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    className="col-span-1 sm:col-span-3 rounded-lg border border-brand-gray px-3 py-2 focus:border-brand-secondary focus:ring-brand-secondary"
                    placeholder={`Jane Doe, 3.2, Female\nJohn Smith, 3.6, M`}
                  />
                  <div>
                    <Button className="bg-brand-secondary text-brand-primary hover:bg-brand-secondary/80 w-full" onClick={parseBulk}>
                      Parse & add
                    </Button>
                  </div>
                </div>
              </details>

              {/* Continue button lives here so mobile flow is: settings → add players → continue */}
              <div className="mt-4 pt-3 border-t border-brand-gray/40 grid grid-cols-1 gap-2">
                <Button
                  className="bg-brand-primary text-brand-white hover:bg-brand-primary/90 w-full h-14 text-base font-bold"
                  onClick={() => setTab('roster')}
                >
                  Continue to Roster →
                </Button>
                {rounds.length > 0 && (
                  <Button
                    className="bg-red-500 text-white hover:bg-red-600 w-full"
                    onClick={clearAllRounds}
                  >
                    Clear All Rounds
                  </Button>
                )}
              </div>
            </Card>
          </div>
        )}

        {tab === 'roster' && (
          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-primary">Roster ({players.length})</h3>
              <div className="text-xs text-brand-primary/70">Present: {presentPlayers.length}</div>
            </div>

            {rounds.length > 0 && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="text-sm text-yellow-800">
                  ⚠️ <strong>Event in Progress:</strong> You can add/remove players anytime. Stats are preserved!
                </div>
              </div>
            )}

            {players.length === 0 && (
              <div className="mt-4 rounded-2xl border-2 border-dashed border-brand-secondary/40 bg-brand-secondary/5 px-5 py-6 text-center">
                <div className="text-3xl mb-2">👋</div>
                <div className="font-bold text-brand-primary text-base mb-1">Add your first player</div>
                <p className="text-sm text-brand-primary/70 leading-relaxed">
                  Use the form below to add players.
                  Then tap the <strong className="text-brand-primary">✓ circle</strong> next to each name to mark them as present today.
                </p>
                <div className="mt-3 text-xs text-brand-primary/50">
                  Tip: you can add or remove players anytime, even mid-session.
                </div>
              </div>
            )}

            <div className="mt-3 space-y-2">
              {players.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 min-h-[60px] transition-all
                    ${p.present
                      ? 'border-brand-secondary bg-brand-secondary/5'
                      : 'border-brand-gray bg-white opacity-60'
                    }`}
                >
                  {/* Presence toggle — large tap target */}
                  <button
                    onClick={() => togglePresent(p.id)}
                    className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors
                      ${p.present
                        ? 'bg-brand-secondary border-brand-secondary text-white font-bold'
                        : 'border-brand-gray text-transparent'
                      }`}
                    aria-label={p.present ? 'Mark absent' : 'Mark present'}
                  >
                    ✓
                  </button>

                  {/* Name input */}
                  <input
                    value={p.name}
                    onChange={(e) => updatePlayerField(p.id, 'name', e.target.value)}
                    onBlur={() => {
                      if (user) {
                        api.players.update(p.id, {
                          player_name: p.name,
                          dupr_rating: p.rating,
                          gender: p.gender
                        }).catch(console.error);
                      }
                    }}
                    className="flex-1 min-w-0 bg-transparent text-base font-semibold text-brand-primary focus:outline-none border-b border-transparent focus:border-brand-secondary"
                  />

                  {/* Rating input */}
                  <input
                    type="number"
                    step="0.1"
                    min="2.0"
                    max="5.5"
                    value={p.rating}
                    onChange={(e) => updatePlayerField(p.id, 'rating', Number(e.target.value))}
                    onBlur={() => {
                      if (user) {
                        api.players.update(p.id, {
                          player_name: p.name,
                          dupr_rating: p.rating,
                          gender: p.gender
                        }).catch(console.error);
                      }
                    }}
                    className="w-14 text-center bg-brand-gray/30 rounded-lg px-1 py-1 text-sm font-semibold text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  />

                  {/* Remove */}
                  <button
                    onClick={() => removePlayer(p.id)}
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    aria-label="Remove player"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>


          </Card>
        )}

        {tab === 'roster' && gameFormat === 'teamed_doubles' && (() => {
          const assignedIds = new Set(teams.flatMap(t => [t.player1.id, t.player2.id]));
          const unassigned = presentPlayers.filter(p => !assignedIds.has(p.id));

          const handlePlayerSelect = (player) => {
            if (!teamBuilderSelected) { setTeamBuilderSelected(player); return; }
            if (teamBuilderSelected.id === player.id) { setTeamBuilderSelected(null); return; }
            const p1 = teamBuilderSelected, p2 = player;
            const gender = (p1.gender === 'male' && p2.gender === 'male') ? 'male_male'
              : (p1.gender === 'female' && p2.gender === 'female') ? 'female_female' : 'mixed';
            setTeams(prev => [...prev, { id: uid(), player1: p1, player2: p2, gender, avgRating: (Number(p1.rating) + Number(p2.rating)) / 2 }]);
            setTeamBuilderSelected(null);
          };

          const autoAssignStacked = () => {
            const sorted = [...unassigned].sort((a, b) => Number(b.rating) - Number(a.rating));
            const newTeams = [];
            for (let i = 0; i + 1 < sorted.length; i += 2) {
              const p1 = sorted[i], p2 = sorted[i + 1];
              const gender = (p1.gender === 'male' && p2.gender === 'male') ? 'male_male'
                : (p1.gender === 'female' && p2.gender === 'female') ? 'female_female' : 'mixed';
              newTeams.push({ id: uid(), player1: p1, player2: p2, gender, avgRating: (Number(p1.rating) + Number(p2.rating)) / 2 });
            }
            setTeams(prev => [...prev, ...newTeams]);
          };

          const autoAssignBalanced = () => {
            const sorted = [...unassigned].sort((a, b) => Number(b.rating) - Number(a.rating));
            const newTeams = [];
            let lo = sorted.length - 1;
            for (let hi = 0; hi < lo; hi++, lo--) {
              const p1 = sorted[hi], p2 = sorted[lo];
              const gender = (p1.gender === 'male' && p2.gender === 'male') ? 'male_male'
                : (p1.gender === 'female' && p2.gender === 'female') ? 'female_female' : 'mixed';
              newTeams.push({ id: uid(), player1: p1, player2: p2, gender, avgRating: (Number(p1.rating) + Number(p2.rating)) / 2 });
            }
            setTeams(prev => [...prev, ...newTeams]);
          };

          const removeTeam = (teamId) => { setTeams(prev => prev.filter(t => t.id !== teamId)); setTeamBuilderSelected(null); };

          return (
            <Card className="mt-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-brand-primary">Team Builder</h3>
                <span className="text-xs text-brand-primary/60">{teams.length} team{teams.length !== 1 ? 's' : ''} formed· {unassigned.length} unassigned</span>
              </div>

              {teamBuilderSelected && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-brand-secondary/20 border border-brand-secondary text-xs text-brand-primary font-medium">
                  ✋ <strong>{teamBuilderSelected.name}</strong> selected — now click a second player to complete the pair
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-brand-primary/70 uppercase tracking-wide mb-2">Unassigned ({unassigned.length})</p>
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                    {unassigned.length === 0 && <p className="text-xs text-brand-primary/50 italic py-2">All players assigned ✓</p>}
                    {unassigned.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handlePlayerSelect(p)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm ${teamBuilderSelected?.id === p.id
                          ? 'border-brand-secondary bg-brand-secondary/20 font-semibold'
                          : 'border-brand-gray bg-white hover:border-brand-secondary/50 hover:bg-brand-secondary/10'
                          }`}
                      >
                        <span>{p.name}</span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs text-brand-primary/60">({p.rating})</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${p.gender === 'female' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                            {p.gender === 'female' ? 'W' : 'M'}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-brand-primary/70 uppercase tracking-wide mb-2">Teams ({teams.length})</p>
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                    {teams.length === 0 && <p className="text-xs text-brand-primary/50 italic py-2">No teams yet — pair players from the left</p>}
                    {teams.map(team => (
                      <div key={team.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-brand-gray bg-white text-sm">
                        <div>
                          <div className="font-medium text-brand-primary">{team.player1.name} &amp; {team.player2.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-brand-primary/60">Avg {team.avgRating.toFixed(2)}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${team.gender === 'male_male' ? 'bg-blue-100 text-blue-700'
                              : team.gender === 'female_female' ? 'bg-pink-100 text-pink-700'
                                : 'bg-purple-100 text-purple-700'
                              }`}>{team.gender === 'male_male' ? 'M/M' : team.gender === 'female_female' ? 'W/W' : 'Mixed'}</span>
                          </div>
                        </div>
                        <button onClick={() => removeTeam(team.id)} className="text-brand-primary/40 hover:text-red-500 transition-colors text-lg leading-none ml-2" title="Remove team">×</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {unassigned.length >= 2 && (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-xs text-brand-primary/60 font-medium">Auto-pair {unassigned.length} unassigned players:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={autoAssignStacked} className="px-3 py-2 rounded-lg border border-brand-primary text-brand-primary text-xs font-semibold hover:bg-brand-primary hover:text-white transition-colors text-left">
                      <div className="font-bold mb-0.5">⚡ Stacked</div>
                      <div className="font-normal opacity-70">Top-rated together · competitive feel</div>
                    </button>
                    <button onClick={autoAssignBalanced} className="px-3 py-2 rounded-lg border border-brand-secondary text-brand-primary text-xs font-semibold hover:bg-brand-secondary/20 transition-colors text-left">
                      <div className="font-bold mb-0.5">⚖️ Balanced</div>
                      <div className="font-normal opacity-70">Best + weakest paired · even matches</div>
                    </button>
                  </div>
                  {unassigned.length % 2 !== 0 && <p className="text-xs text-amber-600 italic">⚠️ Odd number of players — 1 will remain unassigned</p>}
                </div>
              )}

              {teams.length < 2 && presentPlayers.length >= 4 && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-xs text-yellow-800">⚠️ You need at least 2 teams to start a tournament.</div>
                </div>
              )}

              {teams.length > 0 && (
                <button onClick={() => { setTeams([]); setTeamBuilderSelected(null); }} className="mt-2 text-xs text-brand-primary/40 hover:text-red-500 transition-colors">
                  Clear all teams
                </button>
              )}
            </Card>
          );
        })()}

        {tab === 'roster' && (
          <div className="flex flex-col gap-2">
            <Button
              className="bg-brand-primary text-brand-white hover:bg-brand-primary/90 w-full"
              onClick={generateNextRound}
              disabled={gameFormat === 'teamed_doubles' ? teams.length < 2 : presentPlayers.length < 4}
            >
              {currentRound === 0 ? 'Start Tournament (Generate Round 1)' : 'Generate Next Round'}
            </Button>
            {rounds.length > 0 && (
              <Button
                className="bg-red-500 text-white hover:bg-red-600 w-full"
                onClick={clearAllRounds}
              >
                Clear All Rounds
              </Button>
            )}
          </div>
        )}

        {tab === 'stats' && (
          <Card>
            <h3 className="text-sm font-semibold text-brand-primary mb-3">
              {tournamentType === 'king_of_court' ? '👑 Leaderboard' : 'Player Statistics'}
            </h3>
            {((tournamentType === 'king_of_court' && gameFormat === 'teamed_doubles' && Object.keys(kotTeamStats).length === 0) ||
              (tournamentType === 'king_of_court' && gameFormat !== 'teamed_doubles' && Object.keys(kotStats).length === 0) ||
              (tournamentType === 'round_robin' && rounds.length === 0)) ? (
              <div className="py-8 text-center space-y-3">
                <div className="text-4xl">📊</div>
                <div className="font-bold text-brand-primary text-lg">No stats yet</div>
                <p className="text-sm text-brand-primary/70 leading-relaxed max-w-xs mx-auto">
                  Stats appear here automatically after you generate rounds on the
                  <strong className="text-brand-primary"> Schedule</strong> tab and complete matches.
                  No manual entry needed!
                </p>
                <button
                  onClick={() => { setTab('schedule'); }}
                  className="mt-2 inline-block px-5 py-2 rounded-xl bg-brand-primary text-white text-sm font-semibold"
                >
                  Go to Schedule →
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-brand-white">
                    <tr className="text-left">
                      {tournamentType === 'king_of_court' && <th className="p-2">Rank</th>}
                      <th className="p-2">{tournamentType === 'king_of_court' && gameFormat === 'teamed_doubles' ? 'Team' : 'Player'}</th>
                      <th className="p-2">DUPR</th>
                      {tournamentType === 'king_of_court' ? (
                        <>
                          <th className="p-2">Points</th>
                          <th className="p-2">👑 Wins</th>
                          <th className="p-2">Current Court</th>
                        </>
                      ) : (
                        <>
                          <th className="p-2">Played</th>
                          <th className="p-2">Sat Out</th>
                          <th className="p-2">Status</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {getPlayerStatsDisplay()?.map((p, idx) => (
                      <tr key={p.id} className="border-t border-brand-gray/60">
                        {tournamentType === 'king_of_court' && (
                          <td className="p-2 font-bold">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                          </td>
                        )}
                        <td className="p-2 font-medium">
                          {p.isTeam ? `${p.player1.name} / ${p.player2.name}` : p.name}
                        </td>
                        <td className="p-2">
                          {p.isTeam ? p.avgRating.toFixed(1) : p.rating}
                        </td>
                        {tournamentType === 'king_of_court' ? (
                          <>
                            <td className="p-2 font-bold text-brand-primary">{p.totalPoints}</td>
                            <td className="p-2">{p.court1Wins}</td>
                            <td className="p-2">
                              {p.currentCourt ? (
                                <span className={`text-xs px-2 py-1 rounded ${p.currentCourt === 1 ? 'bg-yellow-100 text-yellow-800 font-bold' : 'bg-gray-100 text-gray-700'
                                  }`}>
                                  {p.currentCourt === 1 ? '👑 Court 1' : `Court ${p.currentCourt}`}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">Not assigned</span>
                              )}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-2">{p.roundsPlayed}</td>
                            <td className="p-2">{p.roundsSatOut}</td>
                            <td className="p-2">
                              <span className={`text-xs px-2 py-1 rounded ${p.present ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {p.present ? 'Present' : 'Absent'}
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}


        {tab === 'schedule' && (
          <div className="space-y-3">
            {/* ── Court Flow (Round Robin / KoC only) ── */}
            {(tournamentType === 'round_robin' || tournamentType === 'king_of_court') && (
              <div className="space-y-2">

                {/* Generate Round button */}
                {rounds.length === 0 && (
                  <button
                    onClick={() => { generateNextRound(); setScheduleView('rounds'); }}
                    disabled={presentPlayers.length < 4}
                    className="w-full h-14 rounded-2xl bg-brand-primary text-white text-base font-bold shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
                  >
                    🎾 Generate First Round
                  </button>
                )}
                {courtStates.every(c => c.status === 'ready') && rounds.length > 0 && (
                  <button
                    onClick={() => { generateNextRound(); setScheduleView('rounds'); }}
                    className="w-full h-14 rounded-2xl bg-brand-primary text-white text-base font-bold shadow-lg active:scale-[0.98] transition-transform"
                  >
                    🎾 Start Round {currentRound + 1}
                  </button>
                )}

                {/* ── Compact Court Strip ── */}
                <div className="overflow-x-auto pb-1">
                  <div className="flex gap-2 min-w-max">
                    {courtStates.map(court => {
                      const isPlaying = court.status === 'playing';
                      const isCleaning = court.status === 'cleaning';
                      const cm = court.currentMatch;

                      const bgColor = isPlaying
                        ? 'bg-green-500'
                        : isCleaning
                          ? 'bg-orange-400'
                          : 'bg-gray-200';
                      const textColor = isPlaying || isCleaning ? 'text-white' : 'text-gray-600';

                      // Short player label for the pill
                      const shortLabel = cm
                        ? cm.gameFormat === 'singles'
                          ? `${cm.player1?.name?.split(' ')[0]} v ${cm.player2?.name?.split(' ')[0]}`
                          : `${cm.team1?.[0]?.name?.split(' ')[0]}/${cm.team1?.[1]?.name?.split(' ')[0]} v ${cm.team2?.[0]?.name?.split(' ')[0]}/${cm.team2?.[1]?.name?.split(' ')[0]}`
                        : 'No match';

                      return (
                        <div
                          key={court.courtNumber}
                          className={`rounded-2xl ${bgColor} shadow flex flex-col items-center justify-between overflow-hidden`}
                          style={{ minWidth: 130, maxWidth: 150 }}
                        >
                          {/* Header */}
                          <div className="w-full px-3 pt-2 pb-1 flex items-center justify-between">
                            <span className={`font-bold text-sm ${textColor}`}>Ct {court.courtNumber}</span>
                            <span className={`text-xs font-semibold uppercase ${textColor} opacity-80`}>{court.status}</span>
                          </div>

                          {/* Match summary + spread indicator */}
                          <div className={`w-full px-3 pb-1 text-xs ${textColor} font-medium leading-snug text-center`}
                            style={{ minHeight: 32 }}>
                            {shortLabel}
                            {cm && cm.team1 && cm.team2 && (() => {
                              const avg = arr => arr.reduce((s, p) => s + (Number(p?.rating) || 0), 0) / arr.length;
                              const spread = Math.abs(avg(cm.team1) - avg(cm.team2));
                              const dot = spread <= 0.2 ? '🟢' : spread <= 0.4 ? '🟡' : '🔴';
                              return <div className="mt-0.5 opacity-90">Δ{spread.toFixed(2)} {dot}</div>;
                            })()}
                          </div>

                          {/* Action button */}
                          <div className="w-full px-2 pb-2">
                            {isPlaying && (
                              <button
                                onClick={() => setScoreSheet({ courtNumber: court.courtNumber })}
                                className="w-full rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold py-1.5 active:scale-95 transition-transform"
                              >
                                ✓ Score
                              </button>
                            )}
                            {court.status === 'ready' && !cm && (
                              <button
                                onClick={() => assignMatchToCourt(court.courtNumber, true)}
                                className="w-full rounded-xl bg-brand-primary/80 hover:bg-brand-primary text-white text-xs font-bold py-1.5 active:scale-95 transition-transform"
                              >
                                + Assign
                              </button>
                            )}
                            {isCleaning && cm && (
                              <button
                                onClick={() => completeCourtMatch(court.courtNumber)}
                                className="w-full rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold py-1.5 active:scale-95 transition-transform"
                              >
                                ✓ Done
                              </button>
                            )}
                            {isCleaning && !cm && (
                              <button
                                onClick={() => setCourtStates(prev => prev.map(c =>
                                  c.courtNumber === court.courtNumber ? { ...c, status: 'ready', currentMatch: null } : c
                                ))}
                                className="w-full rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold py-1.5 active:scale-95 transition-transform"
                              >
                                ✓ Ready
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Undo */}
                {rounds.some(r => r.some(m => m.status === 'completed')) && (
                  <button
                    onClick={undoLastMatch}
                    className="w-full h-9 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold"
                  >
                    ↩ Undo
                  </button>
                )}

                {/* ── Courts / Rounds sub-tabs ── */}
                <div className="flex rounded-xl overflow-hidden border border-brand-gray bg-white shadow-sm mt-1">
                  {[['courts', '🏟️ Courts'], ['rounds', '📋 Rounds']].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setScheduleView(key)}
                      className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${scheduleView === key
                        ? 'bg-brand-primary text-white'
                        : 'text-brand-primary/60 hover:bg-brand-gray/30'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Courts view — Next Up queue + cleaning controls */}
                {scheduleView === 'courts' && (
                  <Card>
                    <h3 className="text-sm font-semibold text-brand-primary mb-3">Next Up (Not Currently Playing)</h3>
                    {getNextUpQueue.length === 0 ? (
                      <p className="text-sm text-brand-primary/70">
                        {presentPlayers.length === 0
                          ? '⚠️ No players marked present — go to the Roster tab and check players in.'
                          : 'All players are currently on a court.'}
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-brand-white">
                            <tr className="text-left">
                              <th className="p-2">Priority</th>
                              <th className="p-2">{gameFormat === 'teamed_doubles' ? 'Team' : 'Player'}</th>
                              <th className="p-2">Rating</th>
                              <th className="p-2">Played</th>
                              <th className="p-2">Sat Out</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getNextUpQueue.map((item, idx) => (
                              <tr key={item.id} className="border-t border-brand-gray/60">
                                <td className="p-2 font-bold text-brand-primary">{idx + 1}</td>
                                <td className="p-2">
                                  {gameFormat === 'teamed_doubles'
                                    ? `${item.player1.name} / ${item.player2.name}`
                                    : item.name
                                  }
                                </td>
                                <td className="p-2">
                                  {gameFormat === 'teamed_doubles'
                                    ? item.avgRating.toFixed(2)
                                    : item.rating
                                  }
                                </td>
                                <td className="p-2">{item.roundsPlayed || 0}</td>
                                <td className="p-2">{item.roundsSatOut || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            )}


            {/* ── Match History (Rounds view) ── */}
            {scheduleView === 'rounds' && (<>
              <div className="border-t-2 border-brand-gray/40 pt-3">
                <h3 className="text-sm font-semibold text-brand-primary mb-3">Match History</h3>
                {rounds.length === 0 && (
                  <div className="rounded-2xl border-2 border-dashed border-brand-gray bg-white px-5 py-8 text-center space-y-4">
                    <div className="text-5xl">🎾</div>
                    <div className="font-bold text-brand-primary text-xl">Ready to play?</div>
                    <p className="text-sm text-brand-primary/70 leading-relaxed max-w-xs mx-auto">
                      Here's how to get your first round going:
                    </p>
                    <div className="text-left space-y-3 max-w-xs mx-auto">
                      {[
                        { n: 1, text: 'Make sure players are marked present on the Roster tab' },
                        { n: 2, text: 'Tap the green Generate First Round button above' },
                        { n: 3, text: 'Assign each match to a court and let the games begin!' },
                      ].map(s => (
                        <div key={s.n} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-primary text-white text-xs font-bold flex items-center justify-center">{s.n}</span>
                          <span className="text-sm text-brand-primary/80 leading-relaxed pt-0.5">{s.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {rounds.map((round, rIdx) => {
                const isLatest = rIdx === rounds.length - 1;
                const completedCount = round.filter(m => m.status === 'completed').length;
                const allDone = completedCount === round.length && round.length > 0;
                return (
                  <details key={rIdx} open={isLatest}>
                    <summary className="list-none cursor-pointer select-none">
                      <div className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 mb-2 transition-colors ${isLatest
                        ? 'border-brand-primary bg-brand-primary text-brand-white'
                        : allDone
                          ? 'border-green-400 bg-green-50 text-green-800'
                          : 'border-brand-gray bg-brand-white text-brand-primary'
                        }`}>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-base">Round {rIdx + 1}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isLatest
                            ? 'bg-white/20 text-white'
                            : allDone
                              ? 'bg-green-200 text-green-800'
                              : 'bg-brand-gray text-brand-primary/70'
                            }`}>
                            {isLatest ? '▶ Current' : allDone ? '✓ Completed' : `${completedCount}/${round.length} done`}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs ${isLatest ? 'text-white/70' : 'text-brand-primary/50'}`}>
                            {round.length} {round.length === 1 ? 'match' : 'matches'}
                          </span>
                          <span className={`text-sm transition-transform details-chevron ${isLatest ? 'text-white' : 'text-brand-primary/60'}`}>
                            ▾
                          </span>
                        </div>
                      </div>
                    </summary>

                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                      {round.map((m, i) => (
                        <Card key={m.id} className="relative bg-brand-white">
                          <div className="absolute right-3 top-3 flex items-center gap-2 text-[11px] sm:text-xs text-brand-primary/60 flex-wrap justify-end">
                            <span>Diff {m.diff?.toFixed?.(2) ?? '--'}</span>
                            {m.teamGender && (
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${m.teamGender === 'male_male' ? 'bg-blue-100 text-blue-700' :
                                m.teamGender === 'female_female' ? 'bg-pink-100 text-pink-700' :
                                  'bg-purple-100 text-purple-700'
                                }`}>
                                {m.teamGender === 'male_male' ? 'M/M' :
                                  m.teamGender === 'female_female' ? 'F/F' : 'Mixed'}
                              </span>
                            )}
                            {m.courtLevel && (
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${m.courtLevel === 'KING' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'
                                }`}>
                                {m.courtLevel === 'KING' ? '👑 KING' : m.courtLevel}
                              </span>
                            )}
                            {m.skillLevel && !m.courtLevel && (
                              <span className={`px-2 py-0.5 rounded text-xs ${m.skillLevel === 'Beginner' ? 'bg-red-100 text-red-700' :
                                m.skillLevel === 'Advanced Beginner' ? 'bg-orange-100 text-orange-700' :
                                  m.skillLevel === 'Intermediate' ? 'bg-yellow-100 text-yellow-700' :
                                    m.skillLevel === 'Advanced Intermediate' ? 'bg-green-100 text-green-700' :
                                      m.skillLevel === 'Advanced' ? 'bg-blue-100 text-blue-700' :
                                        m.skillLevel === 'Expert' ? 'bg-purple-100 text-purple-700' :
                                          m.skillLevel === 'Expert Pro' ? 'bg-pink-100 text-pink-700' :
                                            'bg-gray-100 text-gray-700'
                                }`}>
                                {m.skillLevel}
                              </span>
                            )}
                          </div>
                          {/* Full-width court header - immediately visible for scorekeepers */}
                          <div className="-mx-3 sm:-mx-4 -mt-3 sm:-mt-4 mb-3 px-4 py-2 bg-brand-primary rounded-t-2xl flex items-center justify-between">
                            <span className="text-white font-bold text-base tracking-wide">
                              Court {m.court}
                            </span>
                            {m.pointsForWin && (
                              <span className="text-brand-secondary font-bold text-sm">
                                {m.pointsForWin} pts/win
                              </span>
                            )}
                          </div>

                          {/* Singles Format */}
                          {m.gameFormat === 'singles' && m.player1 && m.player2 ? (
                            <>
                              <div className="mt-1">
                                <div className="font-semibold text-brand-primary text-sm">Player 1</div>
                                <div className="text-brand-primary/90">
                                  <div className="text-sm sm:text-base font-medium">{m.player1.name} <span className="text-xs text-brand-primary/60">({m.player1.rating})</span></div>
                                </div>
                              </div>

                              <div className="mt-2">
                                <div className="font-semibold text-brand-primary text-sm">Player 2</div>
                                <div className="text-brand-primary/90">
                                  <div className="text-sm sm:text-base font-medium">{m.player2.name} <span className="text-xs text-brand-primary/60">({m.player2.rating})</span></div>
                                </div>
                              </div>
                            </>
                          ) : (
                            /* Doubles Format (regular and teamed) */
                            <>
                              <div className="mt-1">
                                <div className="font-semibold text-brand-primary text-sm">Team 1</div>
                                {m.team1 ? (
                                  <div className="text-brand-primary/90">
                                    <div className="text-sm sm:text-base font-medium">{m.team1[0].name} <span className="text-xs text-brand-primary/60">({m.team1[0].rating})</span></div>
                                    <div className="text-sm sm:text-base font-medium">{m.team1[1].name} <span className="text-xs text-brand-primary/60">({m.team1[1].rating})</span></div>
                                  </div>
                                ) : <div className="text-sm">TBD</div>}
                              </div>

                              <div className="mt-2">
                                <div className="font-semibold text-brand-primary text-sm">Team 2</div>
                                {m.team2 ? (
                                  <div className="text-brand-primary/90">
                                    <div className="text-sm sm:text-base font-medium">{m.team2[0].name} <span className="text-xs text-brand-primary/60">({m.team2[0].rating})</span></div>
                                    <div className="text-sm sm:text-base font-medium">{m.team2[1].name} <span className="text-xs text-brand-primary/60">({m.team2[1].rating})</span></div>
                                  </div>
                                ) : <div className="text-sm">TBD</div>}
                              </div>
                            </>
                          )
                          }

                          {/* ── Rating fairness row (doubles only) ── */}
                          {m.team1 && m.team2 && m.gameFormat !== 'singles' && (() => {
                            const avg = arr => arr.reduce((s, p) => s + (Number(p?.rating) || 0), 0) / arr.length;
                            const t1 = avg(m.team1);
                            const t2 = avg(m.team2);
                            const spread = Math.abs(t1 - t2);
                            const spreadColor = spread <= 0.2
                              ? 'bg-green-100 text-green-700'
                              : spread <= 0.4
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700';
                            return (
                              <div className="mt-2 flex items-center gap-2 text-xs text-brand-primary/70">
                                <span className="font-medium">Balance:</span>
                                <span className="font-mono">{t1.toFixed(2)}</span>
                                <span>vs</span>
                                <span className="font-mono">{t2.toFixed(2)}</span>
                                <span className={`ml-auto px-2 py-0.5 rounded font-bold ${spreadColor}`}>
                                  Δ {spread.toFixed(2)}
                                </span>
                              </div>
                            );
                          })()}

                          <div className="mt-3 flex flex-col gap-2">
                            {/* Best of 3 scoring */}
                            {m.matchFormat === 'best_of_3' ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-brand-primary/70 w-16">Game 1:</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={m.game1Score1 === '' ? '' : m.game1Score1 ?? ''}
                                    onChange={(e) => updateScore(rIdx, i, 'game1Score1', e.target.value)}
                                    className="w-16 h-9 rounded border border-brand-gray px-2 text-sm"
                                  />
                                  <span className="text-brand-primary">–</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={m.game1Score2 === '' ? '' : m.game1Score2 ?? ''}
                                    onChange={(e) => updateScore(rIdx, i, 'game1Score2', e.target.value)}
                                    className="w-16 h-9 rounded border border-brand-gray px-2 text-sm"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-brand-primary/70 w-16">Game 2:</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={m.game2Score1 === '' ? '' : m.game2Score1 ?? ''}
                                    onChange={(e) => updateScore(rIdx, i, 'game2Score1', e.target.value)}
                                    className="w-16 h-9 rounded border border-brand-gray px-2 text-sm"
                                  />
                                  <span className="text-brand-primary">–</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={m.game2Score2 === '' ? '' : m.game2Score2 ?? ''}
                                    onChange={(e) => updateScore(rIdx, i, 'game2Score2', e.target.value)}
                                    className="w-16 h-9 rounded border border-brand-gray px-2 text-sm"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-brand-primary/70 w-16">Game 3:</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={m.game3Score1 === '' ? '' : m.game3Score1 ?? ''}
                                    onChange={(e) => updateScore(rIdx, i, 'game3Score1', e.target.value)}
                                    className="w-16 h-9 rounded border border-brand-gray px-2 text-sm"
                                  />
                                  <span className="text-brand-primary">–</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={m.game3Score2 === '' ? '' : m.game3Score2 ?? ''}
                                    onChange={(e) => updateScore(rIdx, i, 'game3Score2', e.target.value)}
                                    className="w-16 h-9 rounded border border-brand-gray px-2 text-sm"
                                  />
                                </div>
                              </div>
                            ) : (
                              /* Single match scoring */
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  value={m.score1 === '' ? '' : m.score1 ?? ''}
                                  onChange={(e) => updateScore(rIdx, i, 'score1', e.target.value)}
                                  className="w-20 h-10 rounded border border-brand-gray px-2"
                                />
                                <span className="text-brand-primary">–</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={m.score2 === '' ? '' : m.score2 ?? ''}
                                  onChange={(e) => updateScore(rIdx, i, 'score2', e.target.value)}
                                  className="w-20 h-10 rounded border border-brand-gray px-2"
                                />
                              </div>
                            )}


                            {m.status !== 'completed' ? (() => {
                              // Check if this match is currently active on a court
                              const activeCourt = courtStates.find(
                                c => c.status === 'playing' && c.currentMatch &&
                                  (c.currentMatch.id === m.id || c.courtNumber === m.court)
                              );
                              // Build player labels
                              const getN = p => (p && typeof p === 'object') ? p.name : (p || '');
                              const t1Label = m.gameFormat === 'singles'
                                ? getN(m.player1)
                                : (m.team1 ? m.team1.map(getN).join(' & ') : 'Team 1');
                              const t2Label = m.gameFormat === 'singles'
                                ? getN(m.player2)
                                : (m.team2 ? m.team2.map(getN).join(' & ') : 'Team 2');
                              // Score-aware highlighting
                              const s1 = Number(m.score1); const s2 = Number(m.score2);
                              const hasScores = m.score1 !== '' && m.score2 !== '' && !isNaN(s1) && !isNaN(s2) && (s1 > 0 || s2 > 0);
                              const t1Winning = hasScores && s1 > s2;
                              const t2Winning = hasScores && s2 > s1;
                              return (
                                <div className="flex flex-col gap-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <Button
                                      className={`w-full text-xs font-bold transition-opacity ${t1Winning ? 'bg-green-500 text-white' : t2Winning ? 'bg-gray-100 text-gray-400 opacity-60' : 'bg-brand-secondary text-brand-primary hover:bg-brand-secondary/80'}`}
                                      onClick={() => quickWin(rIdx, i, 1)}
                                    >
                                      {t1Winning ? '🏆 ' : ''}{t1Label} win
                                    </Button>
                                    <Button
                                      className={`w-full text-xs font-bold transition-opacity ${t2Winning ? 'bg-green-500 text-white' : t1Winning ? 'bg-gray-100 text-gray-400 opacity-60' : 'bg-brand-secondary text-brand-primary hover:bg-brand-secondary/80'}`}
                                      onClick={() => quickWin(rIdx, i, 2)}
                                    >
                                      {t2Winning ? '🏆 ' : ''}{t2Label} win
                                    </Button>
                                  </div>
                                  {activeCourt && (
                                    <button
                                      onClick={() => completeCourtMatch(activeCourt.courtNumber)}
                                      className="w-full h-10 rounded-xl bg-brand-primary text-white text-sm font-bold active:scale-[0.98] transition-transform"
                                    >
                                      ✓ Complete & Clear Court {activeCourt.courtNumber}
                                    </button>
                                  )}
                                </div>
                              );
                            })()
                              : (
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs px-2 py-1 rounded bg-brand-gray text-brand-primary">
                                    Completed
                                  </span>
                                  {m.pointsForWin && (
                                    <span className="text-xs text-brand-primary/70">
                                      +{m.pointsForWin} pts awarded
                                    </span>
                                  )}
                                </div>
                              )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </details>
                );
              })}
            </>)}
          </div >
        )}
      </div >



      {
        endOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50">
            <div className="w-full sm:max-w-lg bg-brand-white rounded-t-2xl sm:rounded-2xl p-4 sm:p-5">
              <h3 className="text-base sm:text-lg font-semibold text-brand-primary">Save results</h3>
              <p className="text-sm text-brand-primary/80 mt-1">
                Download CSV of scores and statistics
              </p>

              <div className="mt-3 space-y-2">
                <Button
                  className="bg-brand-primary text-brand-white hover:bg-brand-primary/90 w-full"
                  onClick={async () => {
                    const results = buildResults(
                      players,
                      rounds,
                      {
                        courts, sessionMinutes, minutesPerRound, tournamentType, separateBySkill, currentRound
                      },
                      tournamentType === 'king_of_court' ? (gameFormat === 'teamed_doubles' ? kotTeamStats : kotStats) : null
                    );
                    const csv = toCSV(results);
                    const filename = `smashboard-${tournamentType}-${new Date().toISOString().slice(0, 10)}.csv`;

                    downloadFile(filename, csv);
                    await emailCSV(csv, filename);
                    setExportedThisSession(true);
                  }}
                >
                  Download CSV
                </Button>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                {!confirmClearOpen ? (
                  <>
                    <Button className="bg-brand-gray text-brand-primary hover:bg-brand-gray/80 w-full" onClick={() => setEndOpen(false)}>
                      Keep Editing
                    </Button>
                    <Button
                      className="bg-brand-primary text-brand-white hover:bg-brand-primary/90 w-full"
                      onClick={() => setConfirmClearOpen(true)}
                    >
                      End & Clear
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col w-full gap-2">
                    <p className="text-sm font-bold text-red-500 text-center mb-1">
                      {!exportedThisSession ? '⚠️ You have not exported! Clear anyway?' : 'Clear all data?'}
                    </p>
                    <div className="flex flex-row gap-2">
                      <Button className="bg-brand-gray text-brand-primary hover:bg-brand-gray/80 w-full" onClick={() => setConfirmClearOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        className="bg-red-500 text-white hover:bg-red-600 w-full font-bold"
                        onClick={() => {
                          isClearingSession.current = true;
                          localStorage.removeItem('pb_session');
                          localStorage.removeItem('pb_roster');
                          saveSession({ rounds: [], players: [], teams: [], playerStats: {}, kotStats: {}, teamStats: {}, kotTeamStats: {}, courtStates: [], currentRound: 0 });
                          clearSession();
                          setPlayers([]);
                          setTeams([]);
                          setKotAutoTeams([]);
                          setRounds([]);
                          setPlayerStats({});
                          setTeamStats({});
                          setKotStats({});
                          setKotTeamStats({});
                          setCurrentRound(0);
                          setExportedThisSession(false);
                          setLocked(false);
                          setTeamBuilderSelected(null);
                          const resetCourts = Array.from({ length: courts }, (_, i) => ({
                            courtNumber: i + 1,
                            status: 'ready',
                            currentMatch: null
                          }));
                          setCourtStates(resetCourts);
                          setConfirmClearOpen(false);
                          setEndOpen(false);
                          setTab('setup');
                          setTimeout(() => { isClearingSession.current = false; }, 500);
                        }}
                      >
                        Yes, Clear Everything
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* ── Fixed Bottom Navigation Bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-brand-white border-t border-brand-gray safe-bottom shadow-[0_-1px_8px_rgba(0,0,0,0.08)]">
        <div className="mx-auto max-w-7xl flex">
          {[
            { k: 'setup', label: 'Setup', icon: '⚙️' },
            { k: 'roster', label: 'Roster', icon: '👥' },
            { k: 'schedule', label: 'Schedule', icon: '📋' },
            { k: 'stats', label: tournamentType === 'king_of_court' ? 'Board' : 'Stats', icon: '📊' },
          ].map(({ k, label, icon }) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-16 text-[11px] font-medium transition-colors select-none
                ${tab === k
                  ? 'text-brand-primary'
                  : 'text-brand-primary/40 hover:text-brand-primary/70'
                }`}
            >
              {/* Active indicator */}
              <span
                className={`absolute top-0 transition-all duration-200 h-0.5 w-8 rounded-b-full
                  ${tab === k ? 'bg-brand-secondary' : 'bg-transparent'}`}
              />
              <span className="text-xl leading-none">{icon}</span>
              <span className={tab === k ? 'font-bold' : ''}>{label}</span>
            </button>
          ))}
          {/* End Session — always visible in nav */}
          <button
            onClick={() => setEndOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 h-16 text-[11px] font-medium text-red-500 hover:text-red-600 transition-colors select-none"
          >
            <span className="text-xl leading-none">🏁</span>
            <span className="font-semibold">End</span>
          </button>
        </div>
      </nav>
      {/* Score Entry Modal - rendered via createPortal inside ScoreModal */}
      <ScoreModal
        scoreSheet={scoreSheet}
        courtStates={courtStates}
        rounds={rounds}
        updateScore={updateScore}
        quickWin={quickWin}
        completeCourtMatch={completeCourtMatch}
        setCourtStates={setCourtStates}
        onRemove={(rIdx, mIdx) => {
          if (rIdx < 0) return;
          setRounds(prev => {
            const updated = prev.map(r => [...r]);
            updated[rIdx][mIdx] = {
              ...updated[rIdx][mIdx],
              status: 'removed',
              winner: null,
              score1: '', score2: '',
              endTime: new Date().toISOString(),
            };
            return updated;
          });
        }}
        onClose={() => setScoreSheet(null)}
      />



      {/* ── Help Bottom Sheet ── */}
      {helpOpen && (() => {
        const HELP = {
          setup: {
            title: '⚙️ Setup',
            subtitle: 'Configure your session and build your roster',
            steps: [
              { n: 1, head: 'Name your session', body: 'Type a name like "Monday Night Pickleball" so you can recognise it later.' },
              { n: 2, head: 'Pick a format', body: 'Choose Doubles, Singles, or King of the Court. Not sure? Doubles is the most popular.' },
              { n: 3, head: 'Set the number of courts', body: 'Enter how many courts you have available. The scheduler will fill them every round.' },
              { n: 4, head: 'Add your players', body: 'Enter players one at a time using the Name, Rating, and Gender fields — or tap "Add multiple players at once" to enter a full list in one go. You can do this the night before to prep your roster in advance.' },
              { n: 5, head: 'Tap "Continue to Roster"', body: 'Once all players are entered, tap the button at the bottom. On game day, you\'ll use the Roster tab to do a roll call — checking off who\'s physically on-site and ready to play.' },
            ],
          },
          roster: {
            title: '👥 Roster — Roll Call',
            subtitle: 'Confirm who is physically present on the courts today',
            steps: [
              { n: 1, head: 'This is your roll call', body: 'Players are added on the Setup tab. Here you\'re confirming who actually showed up today. Great for prepping the night before and checking people in on game day.' },
              { n: 2, head: 'Mark players present', body: 'Tap the ✓ circle next to each player\'s name who is on-site and ready to play. Tap again to mark them absent if they didn\'t show.' },
              { n: 3, head: 'Add late arrivals anytime', body: 'If someone shows up after you\'ve started, you can still add them here mid-session. Their stats will be tracked from that point forward.' },
              { n: 4, head: 'Remove a player', body: 'Tap the red remove button on any player\'s row to take them off the roster. Stats from rounds already completed are always preserved.' },
            ],
          },
          schedule: {
            title: '📋 Schedule',
            subtitle: 'Run your rounds step by step',
            steps: [
              { n: 1, head: 'Generate a round', body: 'Tap the green "Generate First Round" button. The app automatically balances teams by skill and fairness.' },
              { n: 2, head: 'Assign matches to courts', body: 'Each court card shows a match. Tap "Assign Match" to send it to that court, then players head out to play.' },
              { n: 3, head: 'Mark matches complete', body: 'When a game finishes, tap "✓ Complete Match" on that court\'s card. The court is then ready for the next match.' },
              { n: 4, head: 'Start the next round', body: 'When all courts are ready, the "Start Round" button appears at the top. Tap it to generate new matchups.' },
              { n: 5, head: 'Export your results', body: 'When the session is over, tap "End Session" and use the "Download CSV" button to save your results. This file can be uploaded manually to DUPR or other rating tools to update player ratings.' },
            ],
          },
          stats: {
            title: '📊 Stats',
            subtitle: 'Track how everyone is doing',
            steps: [
              { n: 1, head: 'Stats update automatically', body: 'Every time you complete a match, player stats update here — no manual entry needed.' },
              { n: 2, head: 'King of the Court', body: 'In KOT mode, this tab shows the leaderboard with points, crown wins, and current court.' },
              { n: 3, head: 'Round Robin', body: 'In Round Robin mode, you can see how many rounds each player has played or sat out — so no one gets left out.' },
            ],
          },
        };

        const guide = HELP[tab] || HELP.schedule;

        return (
          <>
            <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setHelpOpen(false)} />
            <div className="fixed inset-x-0 bottom-0 z-[70] sheet-enter rounded-t-2xl bg-white shadow-2xl pb-safe max-h-[85vh] overflow-y-auto">
              {/* Pull handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>

              <div className="px-5 pb-6 pt-2 space-y-5">
                {/* Header */}
                <div>
                  <div className="text-xl font-bold text-brand-primary">{guide.title}</div>
                  <div className="text-sm text-brand-primary/60 mt-0.5">{guide.subtitle}</div>
                </div>

                {/* Steps */}
                <div className="space-y-4">
                  {guide.steps.map(step => (
                    <div key={step.n} className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-primary text-white font-bold text-sm flex items-center justify-center">
                        {step.n}
                      </div>
                      <div>
                        <div className="font-semibold text-brand-primary text-base leading-snug">{step.head}</div>
                        <div className="text-sm text-brand-primary/70 mt-0.5 leading-relaxed">{step.body}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tip */}
                <div className="rounded-xl bg-brand-secondary/10 border border-brand-secondary/30 px-4 py-3 text-sm text-brand-primary/80">
                  💡 <strong>Tip:</strong> Tap the <strong>?</strong> button anytime on any tab to see that tab's guide.
                </div>

                {/* Dismiss */}
                <button
                  onClick={() => setHelpOpen(false)}
                  className="w-full h-14 rounded-2xl bg-brand-primary text-white font-bold text-base shadow"
                >
                  Got it ✓
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {/* Debug Panel — dev-only */}
      <DebugPanel log={debugLog} />
    </div>
  );
};

export default PickleballTournamentManager;
