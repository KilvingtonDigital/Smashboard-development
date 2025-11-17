import React, { useEffect, useMemo, useState } from 'react';
import InstallPrompt from './InstallPrompt';

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
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const avg = (t) => (t[0].rating + t[1].rating) / 2;

/* ---- Build export payload ---- */
const buildResults = (players, rounds, meta, kotStats = null) => {
  const matches = [];
  rounds.forEach((r, rIdx) =>
    r.forEach((m) => {
      const s1 = typeof m.score1 === 'number' ? m.score1 : Number(m.score1) || 0;
      const s2 = typeof m.score2 === 'number' ? m.score2 : Number(m.score2) || 0;
      matches.push({
        round: rIdx + 1,
        court: m.court,
        courtLevel: m.courtLevel || null,
        team1: m.team1?.map((p) => ({ id: p.id, name: p.name, rating: p.rating })),
        team2: m.team2?.map((p) => ({ id: p.id, name: p.name, rating: p.rating })),
        score1: s1,
        score2: s2,
        status: m.status,
        winner: m.status === 'completed' ? (s1 > s2 ? 'team1' : 'team2') : null,
        pointsAwarded: m.pointsAwarded || null
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
    'round','court','court_level',
    't1_p1','t1_p1_rating','t1_p2','t1_p2_rating',
    't2_p1','t2_p1_rating','t2_p2','t2_p2_rating',
    'score1','score2','winner','points_awarded'
  ];
  const rows = results.matches.map((m) =>
    [
      m.round, m.court, m.courtLevel || '',
      m.team1?.[0]?.name || '', m.team1?.[0]?.rating || '',
      m.team1?.[1]?.name || '', m.team1?.[1]?.rating || '',
      m.team2?.[0]?.name || '', m.team2?.[0]?.rating || '',
      m.team2?.[1]?.name || '', m.team2?.[1]?.rating || '',
      m.score1, m.score2, m.winner || '', m.pointsAwarded || ''
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
  );
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

  const finalGroups = [];
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
    }
  });

  console.log(`\n=== FINAL SKILL GROUPS (${finalGroups.length} groups) ===`);
  finalGroups.forEach((group, idx) => {
    console.log(`Group ${idx + 1} - ${group.label}: ${group.players.length} players (${group.minRating}-${group.maxRating})`);
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

/* =====================  ROUND ROBIN SCHEDULING  ===================== */

const initializePlayerStats = (playerStats, presentPlayers) => {
  const updatedStats = { ...playerStats };
  
  presentPlayers.forEach(p => {
    if (!updatedStats[p.id]) {
      console.log(`NEW PLAYER ADDED: ${p.name} (${p.rating})`);
      updatedStats[p.id] = {
        player: p,
        roundsPlayed: 0,
        roundsSatOut: 0,
        lastPlayedRound: -1,
        teammates: new Map(),
        opponents: new Map()
      };
    } else {
      updatedStats[p.id].player = p;
    }
  });
  
  return updatedStats;
};

const validateFairness = (playerStats, presentPlayers, currentRound) => {
  if (currentRound === 0) return true;
  
  const playStats = presentPlayers.map(p => {
    const stats = playerStats[p.id] || { roundsPlayed: 0, roundsSatOut: 0 };
    return {
      name: p.name,
      played: stats.roundsPlayed,
      satOut: stats.roundsSatOut
    };
  });
  
  const maxSatOut = Math.max(...playStats.map(s => s.satOut));
  const minSatOut = Math.min(...playStats.map(s => s.satOut));
  const difference = maxSatOut - minSatOut;
  
  if (difference > 1) {
    console.warn('⚠️ FAIRNESS ALERT: Some players have sat out significantly more');
    console.log('Max sat out:', maxSatOut, 'Min sat out:', minSatOut);
    console.log('Players sitting out most:', playStats.filter(s => s.satOut === maxSatOut).map(s => s.name));
  }
  
  return difference <= 1;
};

const generateRoundRobinRound = (presentPlayers, courts, playerStats, currentRoundIndex, separateBySkill = true) => {
  console.log(`\n=== GENERATING ROUND ROBIN ROUND ${currentRoundIndex + 1} ===`);
  console.log(`Present players: ${presentPlayers.length}`);
  
  const updatedStats = initializePlayerStats(playerStats, presentPlayers);
  let matches = [];
  
  if (separateBySkill && presentPlayers.length >= 8) {
    const { groups: skillGroups, bumpedPlayers } = separatePlayersBySkill(presentPlayers, 4);
    
    if (bumpedPlayers.length > 0) {
      console.log(`Players bumped: ${bumpedPlayers.map(p => `${p.name}`).join(', ')}`);
    }
    
    let courtIndex = 1;
    const courtsPerGroup = Math.floor(courts / Math.max(1, skillGroups.length));
    let extraCourts = courts % Math.max(1, skillGroups.length);
    
    skillGroups.forEach((skillGroup) => {
      if (skillGroup.players.length >= 4) {
        const groupCourts = courtsPerGroup + (extraCourts > 0 ? 1 : 0);
        if (extraCourts > 0) extraCourts--;
        
        const groupMatches = generateMatchesForGroup(
          skillGroup.players, 
          updatedStats, 
          groupCourts, 
          courtIndex, 
          currentRoundIndex, 
          skillGroup.label
        );
        matches.push(...groupMatches);
        courtIndex += groupMatches.length;
      }
    });
    
    if (matches.length < courts) {
      console.log(`\nOnly using ${matches.length} of ${courts} courts. Checking for remaining players...`);
      
      const playingIds = new Set();
      matches.forEach(match => {
        if (match.team1) match.team1.forEach(p => playingIds.add(p.id));
        if (match.team2) match.team2.forEach(p => playingIds.add(p.id));
      });
      
      const remainingPlayers = presentPlayers.filter(p => !playingIds.has(p.id));
      const remainingCourts = courts - matches.length;
      
      if (remainingPlayers.length >= 4 && remainingCourts > 0) {
        console.log(`✅ Filling ${remainingCourts} extra court(s) with ${remainingPlayers.length} remaining players (Mixed skill overflow)`);
        
        const extraMatches = createBalancedMatches(
          remainingPlayers,
          updatedStats,
          remainingCourts,
          courtIndex,
          currentRoundIndex,
          'Mixed (Overflow)'
        );
        
        matches.push(...extraMatches);
        console.log(`Added ${extraMatches.length} overflow match(es)`);
      }
    }
    
  } else {
    matches = generateMatchesForGroup(presentPlayers, updatedStats, courts, 1, currentRoundIndex, 'Mixed');
  }

  updatePlayerStatsForRound(updatedStats, presentPlayers, matches, currentRoundIndex);
  validateFairness(updatedStats, presentPlayers, currentRoundIndex);
  Object.assign(playerStats, updatedStats);
  
  console.log(`\n=== ROUND ${currentRoundIndex + 1} SUMMARY ===`);
  console.log(`Courts requested: ${courts}`);
  console.log(`Courts used: ${matches.length}`);
  console.log(`Players present: ${presentPlayers.length}`);
  console.log(`Players playing: ${matches.reduce((sum, m) => sum + 4, 0)}`);
  console.log(`Players sitting: ${presentPlayers.length - matches.reduce((sum, m) => sum + 4, 0)}`);

  if (matches.length < courts) {
    console.warn(`⚠️ WARNING: Only using ${matches.length} of ${courts} courts!`);
  }
  
  return matches;
};

const generateMatchesForGroup = (groupPlayers, playerStats, maxCourts, startingCourtIndex, roundIndex, groupType) => {
  console.log(`Generating ${groupType} matches for ${groupPlayers.length} players`);
  
  const maxPlayersPerRound = maxCourts * 4;
  const playersThisRound = selectPlayersForRound(groupPlayers, playerStats, maxPlayersPerRound, roundIndex);
  
  console.log(`${groupType} - Playing: ${playersThisRound.map(p => `${p.name}(${p.rating})`).join(', ')}`);
  console.log(`${groupType} - Sitting out: ${groupPlayers.filter(p => !playersThisRound.includes(p)).map(p => `${p.name}(${p.rating})`).join(', ')}`);
  
  return createBalancedMatches(playersThisRound, playerStats, maxCourts, startingCourtIndex, roundIndex, groupType);
};

const selectPlayersForRound = (allPlayers, playerStats, maxPlayers, roundIdx) => {
  if (allPlayers.length <= maxPlayers) {
    return [...allPlayers];
  }
  
  const playerPriority = allPlayers.map(p => {
    const stats = playerStats[p.id] || { roundsPlayed: 0, roundsSatOut: 0, lastPlayedRound: -1 };
    let priority = 0;
    
    priority += stats.roundsSatOut * 500;
    
    if (stats.lastPlayedRound >= 0) {
      priority += (roundIdx - stats.lastPlayedRound) * 200;
    } else {
      priority += 1000;
    }
    
    const avgRoundsPlayed = roundIdx > 0 ? 
      Object.values(playerStats).reduce((sum, s) => sum + (s.roundsPlayed || 0), 0) / Object.keys(playerStats).length : 0;
    priority += (avgRoundsPlayed - stats.roundsPlayed) * 100;
    
    priority += Math.random() * 1;
    
    return { player: p, priority, stats };
  });
  
  return playerPriority
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxPlayers)
    .map(item => item.player);
};

const createBalancedMatches = (playersThisRound, playerStats, maxCourts, startingCourtIndex, roundIdx, groupType) => {
  const matches = [];
  const usedPlayers = new Set();
  const availablePlayers = [...playersThisRound];
  const actualCourts = Math.min(maxCourts, Math.floor(availablePlayers.length / 4));
  
  for (let courtIdx = 0; courtIdx < actualCourts; courtIdx++) {
    const remaining = availablePlayers.filter(p => !usedPlayers.has(p.id));
    if (remaining.length < 4) break;
    
    const group = selectBestGroupOfFour(remaining, playerStats);
    if (!group || group.length < 4) break;
    
    const teamSplit = findBestTeamSplit(group, playerStats);
    
    group.forEach(p => usedPlayers.add(p.id));
    
    matches.push({
      id: uid(),
      court: startingCourtIndex + courtIdx,
      team1: teamSplit.team1,
      team2: teamSplit.team2,
      diff: Math.abs(avg(teamSplit.team1) - avg(teamSplit.team2)),
      score1: '',
      score2: '',
      status: 'pending',
      winner: null,
      skillLevel: groupType
    });
  }
  
  return matches;
};

const selectBestGroupOfFour = (availablePlayers, playerStats) => {
  if (availablePlayers.length <= 4) {
    return availablePlayers;
  }
  
  let bestGroup = null;
  let bestScore = Infinity;
  const attempts = Math.min(20, availablePlayers.length);
  
  for (let attempt = 0; attempt < attempts; attempt++) {
    const group = [];
    const candidates = [...availablePlayers];
    
    while (group.length < 4 && candidates.length > 0) {
      if (group.length === 0) {
        const idx = Math.floor(Math.random() * candidates.length);
        group.push(candidates.splice(idx, 1)[0]);
      } else {
        const scores = candidates.map(candidate => {
          let varietyScore = 0;
          
          group.forEach(existing => {
            const stats = playerStats[existing.id] || { teammates: new Map() };
            const timesAsTeammates = stats.teammates.get(candidate.id) || 0;
            varietyScore += Math.max(0, 5 - timesAsTeammates);
          });
          
          const skillCompatible = group.every(existing => canPlayTogether(existing, candidate));
          if (skillCompatible) varietyScore += 2;
          
          varietyScore += Math.random() * 2;
          
          return { player: candidate, score: varietyScore };
        });
        
        scores.sort((a, b) => b.score - a.score);
        const topCandidates = Math.min(3, scores.length);
        const chosenIdx = Math.floor(Math.random() * topCandidates);
        const chosen = scores[chosenIdx].player;
        
        group.push(chosen);
        candidates.splice(candidates.indexOf(chosen), 1);
      }
    }
    
    if (group.length === 4) {
      const groupScore = evaluateGroupQuality(group, playerStats);
      if (groupScore < bestScore) {
        bestScore = groupScore;
        bestGroup = [...group];
      }
    }
  }
  
  return bestGroup || availablePlayers.slice(0, 4);
};

const evaluateGroupQuality = (group, playerStats) => {
  let penalty = 0;
  
  const ratings = group.map(p => p.rating).sort((a, b) => b - a);
  const ratingSpread = ratings[0] - ratings[ratings.length - 1];
  penalty += ratingSpread * 2;
  
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const stats = playerStats[group[i].id] || { teammates: new Map() };
      const timesAsTeammates = stats.teammates.get(group[j].id) || 0;
      penalty += timesAsTeammates * 10;
    }
  }
  
  const skillLevels = group.map(p => getPlayerSkillLevel(p.rating).key);
  const uniqueSkillLevels = new Set(skillLevels).size;
  if (uniqueSkillLevels > 1) {
    const levelIndices = skillLevels.map(level => Object.keys(SKILL_LEVELS).indexOf(level));
    const minIndex = Math.min(...levelIndices);
    const maxIndex = Math.max(...levelIndices);
    if (maxIndex - minIndex > 1) {
      penalty += 25;
    } else {
      penalty += 5;
    }
  }
  
  return penalty;
};

const findBestTeamSplit = (group, playerStats) => {
  const [p1, p2, p3, p4] = group;
  
  const splitOptions = [
    { team1: [p1, p2], team2: [p3, p4] },
    { team1: [p1, p3], team2: [p2, p4] },
    { team1: [p1, p4], team2: [p2, p3] },
  ];
  
  let bestSplit = splitOptions[0];
  let bestScore = Infinity;
  
  splitOptions.forEach(split => {
    let score = 0;
    
    const avg1 = avg(split.team1);
    const avg2 = avg(split.team2);
    score += Math.abs(avg1 - avg2) * 10;
    
    const stats1 = playerStats[split.team1[0].id] || { teammates: new Map() };
    const stats2 = playerStats[split.team2[0].id] || { teammates: new Map() };
    const team1History = stats1.teammates.get(split.team1[1].id) || 0;
    const team2History = stats2.teammates.get(split.team2[1].id) || 0;
    score += (team1History + team2History) * 15;
    
    const level1 = getPlayerSkillLevel(split.team1[0].rating);
    const level2 = getPlayerSkillLevel(split.team1[1].rating);
    const level3 = getPlayerSkillLevel(split.team2[0].rating);
    const level4 = getPlayerSkillLevel(split.team2[1].rating);
    
    if (level1.key === level2.key) score -= 3;
    if (level3.key === level4.key) score -= 3;
    
    if (score < bestScore) {
      bestScore = score;
      bestSplit = split;
    }
  });
  
  return bestSplit;
};

const updatePlayerStatsForRound = (playerStats, presentPlayers, matches, roundIdx) => {
  const playingIds = new Set();
  
  matches.forEach(match => {
    if (match.team1) match.team1.forEach(p => playingIds.add(p.id));
    if (match.team2) match.team2.forEach(p => playingIds.add(p.id));
  });
  
  presentPlayers.forEach(player => {
    const stats = playerStats[player.id];
    if (playingIds.has(player.id)) {
      stats.roundsPlayed++;
      stats.lastPlayedRound = roundIdx;
    } else {
      stats.roundsSatOut++;
    }
  });
  
  matches.forEach(match => {
    const { team1, team2 } = match;
    
    if (team1?.length === 2) {
      const [p1, p2] = team1;
      playerStats[p1.id].teammates.set(p2.id, (playerStats[p1.id].teammates.get(p2.id) || 0) + 1);
      playerStats[p2.id].teammates.set(p1.id, (playerStats[p2.id].teammates.get(p1.id) || 0) + 1);
    }
    
    if (team2?.length === 2) {
      const [p1, p2] = team2;
      playerStats[p1.id].teammates.set(p2.id, (playerStats[p1.id].teammates.get(p2.id) || 0) + 1);
      playerStats[p2.id].teammates.set(p1.id, (playerStats[p2.id].teammates.get(p1.id) || 0) + 1);
    }
    
    team1?.forEach(p1 => {
      team2?.forEach(p2 => {
        playerStats[p1.id].opponents.set(p2.id, (playerStats[p1.id].opponents.get(p2.id) || 0) + 1);
        playerStats[p2.id].opponents.set(p1.id, (playerStats[p2.id].opponents.get(p1.id) || 0) + 1);
      });
    });
  });
};

/* =====================  KING OF COURT MODE  ===================== */

const initializeKingOfCourtStats = (kotStats, presentPlayers, courts) => {
  const updatedStats = { ...kotStats };
  
  presentPlayers.forEach(p => {
    if (!updatedStats[p.id]) {
      console.log(`NEW KOT PLAYER: ${p.name} - assigning to court`);
      updatedStats[p.id] = {
        player: p,
        totalPoints: 0,
        court1Wins: 0,
        currentCourt: null,
        courtHistory: [],
        roundsPlayed: 0,
        roundsSatOut: 0,
        lastPlayedRound: -1  // ADDED: Track last round played
      };
    } else {
      updatedStats[p.id].player = p;
    }
  });
  
  return updatedStats;
};

const getCourtPoints = (courtIndexInHierarchy, courtsInHierarchy) => {
  // courtIndexInHierarchy: 0 = King Court, 1 = Level 2, etc.
  // courtsInHierarchy: total courts in this skill group's hierarchy
  return (courtsInHierarchy - courtIndexInHierarchy) * 2;
};

const generateKingOfCourtRound = (presentPlayers, courts, kotStats, currentRoundIndex, previousRounds, separateBySkill) => {
  console.log(`\n=== GENERATING KING OF COURT ROUND ${currentRoundIndex + 1} ===`);
  
  const updatedStats = initializeKingOfCourtStats(kotStats, presentPlayers, courts);
  const matches = [];
  
  if (separateBySkill && presentPlayers.length >= 8) {
    const { groups: skillGroups } = separatePlayersBySkill(presentPlayers, 4);
    
    let globalCourtIndex = 1;
    
    skillGroups.forEach(skillGroup => {
      if (skillGroup.players.length >= 4) {
        const groupCourts = Math.floor(skillGroup.players.length / 4);
        const actualCourts = Math.min(groupCourts, courts - globalCourtIndex + 1);
        
        if (actualCourts > 0) {
          console.log(`\n${skillGroup.label}: ${skillGroup.players.length} players, ${actualCourts} courts (starting at Court ${globalCourtIndex})`);
          
          const groupMatches = generateKOTMatchesForGroup(
            skillGroup.players,
            updatedStats,
            actualCourts,
            globalCourtIndex,
            currentRoundIndex,
            previousRounds,
            skillGroup.label,
            actualCourts  // ADDED: Pass the number of courts in THIS hierarchy
          );
          
          matches.push(...groupMatches);
          globalCourtIndex += groupMatches.length;
        }
      }
    });
  } else {
    const groupMatches = generateKOTMatchesForGroup(
      presentPlayers,
      updatedStats,
      courts,
      1,
      currentRoundIndex,
      previousRounds,
      'Mixed',
      courts  // ADDED: Pass total courts for non-separated mode
    );
    matches.push(...groupMatches);
  }
  
  Object.assign(kotStats, updatedStats);
  
  console.log(`\n=== KOT ROUND ${currentRoundIndex + 1} SUMMARY ===`);
  console.log(`Courts used: ${matches.length}`);
  console.log(`Players playing: ${matches.reduce((sum, m) => sum + 4, 0)}`);
  
  return matches;
};

const generateKOTMatchesForGroup = (groupPlayers, kotStats, numCourts, startingCourtIndex, roundIndex, previousRounds, groupLabel, courtsInHierarchy) => {
  const matches = [];
  const playersPerCourt = 4;
  const totalPlayers = groupPlayers.length;
  const actualCourts = Math.min(numCourts, Math.floor(totalPlayers / playersPerCourt));
  const maxPlayersThisRound = actualCourts * 4;
  
  console.log(`${groupLabel}: courtsInHierarchy=${courtsInHierarchy}, actualCourts=${actualCourts}`);
  
  let playersToAssign = [...groupPlayers];
  
  // PRIORITY-BASED SELECTION: If we have more players than spots, select fairly
  if (totalPlayers > maxPlayersThisRound) {
    console.log(`${groupLabel}: Selecting ${maxPlayersThisRound} of ${totalPlayers} players using priority system`);
    playersToAssign = selectPlayersForKOTRound(groupPlayers, kotStats, maxPlayersThisRound, roundIndex);
    console.log(`${groupLabel} - Playing: ${playersToAssign.map(p => p.name).join(', ')}`);
    console.log(`${groupLabel} - Sitting out: ${groupPlayers.filter(p => !playersToAssign.includes(p)).map(p => p.name).join(', ')}`);
  }
  
  let playerPool = [...playersToAssign];
  
  if (roundIndex === 0) {
    console.log(`First KOT round for ${groupLabel} - random assignment`);
    playerPool = playerPool.sort(() => Math.random() - 0.5);
  } else {
    console.log(`KOT advancement for ${groupLabel} - sorting by previous round results`);
    playerPool = assignPlayersToCourts(playersToAssign, kotStats, previousRounds, roundIndex, actualCourts, startingCourtIndex);
  }
  
  for (let courtIdx = 0; courtIdx < actualCourts; courtIdx++) {
    const courtNumber = startingCourtIndex + courtIdx;
    const playersForCourt = playerPool.slice(courtIdx * 4, (courtIdx + 1) * 4);
    
    if (playersForCourt.length < 4) break;
    
    const teamSplit = findBestTeamSplit(playersForCourt, {});
    
    playersForCourt.forEach(p => {
      if (kotStats[p.id]) {
        kotStats[p.id].currentCourt = courtNumber;
        kotStats[p.id].courtHistory.push(courtNumber);
        kotStats[p.id].roundsPlayed++;
        kotStats[p.id].lastPlayedRound = roundIndex;
      }
    });
    
    // FIXED: Calculate points based on position in THIS hierarchy
    const courtPoints = getCourtPoints(courtIdx, courtsInHierarchy);
    
    console.log(`  Court ${courtNumber} (index ${courtIdx} in hierarchy): ${courtPoints} pts/win`);
    
    matches.push({
      id: uid(),
      court: courtNumber,
      courtLevel: courtIdx === 0 ? 'KING' : `Level ${courtIdx + 1}`,
      team1: teamSplit.team1,
      team2: teamSplit.team2,
      diff: Math.abs(avg(teamSplit.team1) - avg(teamSplit.team2)),
      score1: '',
      score2: '',
      status: 'pending',
      winner: null,
      skillLevel: groupLabel,
      pointsForWin: courtPoints
    });
  }
  
  // Mark players who are sitting out
  groupPlayers.filter(p => !playersToAssign.includes(p)).forEach(p => {
    if (kotStats[p.id]) {
      kotStats[p.id].roundsSatOut++;
    }
  });
  
  return matches;
};

// SELECT PLAYERS FOR KOT ROUND (Priority-based fairness)
const selectPlayersForKOTRound = (allPlayers, kotStats, maxPlayers, roundIdx) => {
  if (allPlayers.length <= maxPlayers) {
    return [...allPlayers];
  }
  
  console.log(`\n=== KOT PLAYER SELECTION (Round ${roundIdx + 1}) ===`);
  
  const playerPriority = allPlayers.map(p => {
    const stats = kotStats[p.id] || { roundsPlayed: 0, roundsSatOut: 0, lastPlayedRound: -1 };
    let priority = 0;
    
    // HIGHEST priority for sitting out (same as Round Robin)
    priority += stats.roundsSatOut * 500;
    console.log(`${p.name}: sat out ${stats.roundsSatOut} rounds (+${stats.roundsSatOut * 500})`);
    
    // Rounds since last played
    if (stats.lastPlayedRound >= 0) {
      const roundsSince = roundIdx - stats.lastPlayedRound;
      priority += roundsSince * 200;
      if (roundsSince > 0) {
        console.log(`  └─ ${roundsSince} rounds since last played (+${roundsSince * 200})`);
      }
    } else {
      priority += 1000; // Never played
      console.log(`  └─ Never played (+1000)`);
    }
    
    // Catch-up factor
    const avgRoundsPlayed = roundIdx > 0 ? 
      Object.values(kotStats).reduce((sum, s) => sum + (s.roundsPlayed || 0), 0) / Object.keys(kotStats).length : 0;
    const catchup = (avgRoundsPlayed - stats.roundsPlayed) * 100;
    if (catchup > 0) {
      priority += catchup;
      console.log(`  └─ Catch-up factor (+${catchup.toFixed(0)})`);
    }
    
    // Small random factor for tiebreaking
    priority += Math.random() * 1;
    
    console.log(`  TOTAL PRIORITY: ${priority.toFixed(2)}`);
    
    return { player: p, priority, stats };
  });
  
  // Sort by priority (highest first) and take top players
  const selected = playerPriority
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxPlayers)
    .map(item => item.player);
  
  console.log(`\nSelected top ${maxPlayers} players by priority`);
  
  return selected;
};

const assignPlayersToCourts = (groupPlayers, kotStats, previousRounds, roundIndex, numCourts, startingCourtIndex) => {
  if (previousRounds.length === 0) return groupPlayers;
  
  const lastRound = previousRounds[previousRounds.length - 1];
  const playerResults = [];
  
  groupPlayers.forEach(player => {
    let won = false;
    let lastCourt = null;
    
    lastRound.forEach(match => {
      if (match.status === 'completed') {
        const inTeam1 = match.team1?.some(p => p.id === player.id);
        const inTeam2 = match.team2?.some(p => p.id === player.id);
        
        if (inTeam1 || inTeam2) {
          lastCourt = match.court;
          if ((inTeam1 && match.winner === 'team1') || (inTeam2 && match.winner === 'team2')) {
            won = true;
          }
        }
      }
    });
    
    const stats = kotStats[player.id] || { totalPoints: 0, currentCourt: null };
    
    playerResults.push({
      player,
      won,
      lastCourt: lastCourt || startingCourtIndex + numCourts - 1,
      totalPoints: stats.totalPoints || 0
    });
  });
  
  playerResults.sort((a, b) => {
    if (a.lastCourt !== b.lastCourt) {
      return a.lastCourt - b.lastCourt;
    }
    if (a.won !== b.won) {
      return a.won ? -1 : 1;
    }
    return b.totalPoints - a.totalPoints;
  });
  
  const sortedPlayers = [];
  
  for (let courtIdx = 0; courtIdx < numCourts; courtIdx++) {
    const courtNumber = startingCourtIndex + courtIdx;
    
    const winnersFromThisCourt = playerResults.filter(pr => 
      pr.lastCourt === courtNumber && pr.won
    ).map(pr => pr.player);
    
    const winnersFromBelowCourt = courtIdx < numCourts - 1 ? 
      playerResults.filter(pr => 
        pr.lastCourt === courtNumber + 1 && pr.won
      ).map(pr => pr.player).slice(0, 2) : [];
    
    const losersFromThisCourt = playerResults.filter(pr => 
      pr.lastCourt === courtNumber && !pr.won
    ).map(pr => pr.player);
    
    let courtPlayers = [...winnersFromThisCourt];
    
    if (courtIdx === 0) {
      courtPlayers.push(...winnersFromBelowCourt);
    }
    
    while (courtPlayers.length < 4 && losersFromThisCourt.length > 0) {
      courtPlayers.push(losersFromThisCourt.shift());
    }
    
    if (courtPlayers.length < 4) {
      const available = playerResults
        .filter(pr => !sortedPlayers.includes(pr.player))
        .map(pr => pr.player);
      
      while (courtPlayers.length < 4 && available.length > 0) {
        courtPlayers.push(available.shift());
      }
    }
    
    sortedPlayers.push(...courtPlayers.slice(0, 4));
  }
  
  const remaining = groupPlayers.filter(p => !sortedPlayers.includes(p));
  sortedPlayers.push(...remaining);
  
  return sortedPlayers;
};

const updateKOTStats = (kotStats, match) => {
  if (match.status !== 'completed' || !match.winner) return;
  
  const winningTeam = match.winner === 'team1' ? match.team1 : match.team2;
  const points = match.pointsForWin || 0;
  
  winningTeam?.forEach(player => {
    if (kotStats[player.id]) {
      kotStats[player.id].totalPoints += points;
      
      if (match.courtLevel === 'KING') {
        kotStats[player.id].court1Wins++;
      }
    }
  });
};

/* =====================  MAIN COMPONENT  ===================== */
const PickleballTournamentManager = () => {
  const [players, setPlayers] = useState([]);
  const [form, setForm] = useState({ name: '', rating: '', gender: 'male' });
  const [bulkText, setBulkText] = useState('');
  const [addNote, setAddNote] = useState(null);

  const [courts, setCourts] = useState(4);
  const [sessionMinutes, setSessionMinutes] = useState(120);
  const [minutesPerRound, setMinutesPerRound] = useState(20);

  const [tournamentType, setTournamentType] = useState('round_robin');
  const [separateBySkill, setSeparateBySkill] = useState(true);

  const [rounds, setRounds] = useState([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [playerStats, setPlayerStats] = useState({});
  const [kotStats, setKotStats] = useState({});

  const [tab, setTab] = useState('setup');
  const [endOpen, setEndOpen] = useState(false);
  const [exportedThisSession, setExportedThisSession] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const savedRoster = localStorage.getItem('pb_roster');
    if (savedRoster) {
      try { setPlayers(JSON.parse(savedRoster)); } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pb_roster', JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    const snapshot = {
      players, rounds, playerStats, kotStats, currentRound,
      meta: { courts, sessionMinutes, minutesPerRound, tournamentType, separateBySkill, ts: Date.now() },
      locked
    };
    localStorage.setItem('pb_session', JSON.stringify(snapshot));
  }, [players, rounds, playerStats, kotStats, currentRound, courts, sessionMinutes, minutesPerRound, tournamentType, separateBySkill, locked]);

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

  const addPlayer = () => {
    const name = form.name.trim();
    const rating = Number(form.rating);
    if (!name) return alert('Name is required');
    if (Number.isNaN(rating) || rating < 2.0 || rating > 5.5) return alert('Enter DUPR 2.0 – 5.5');
    
    setPlayers((prev) => [...prev, { id: uid(), name, rating, gender: form.gender, present: true }]);
    setForm({ name: '', rating: '', gender: 'male' });

    setAddNote(`Added ${name} – check Roster`);
    setTimeout(() => setAddNote(null), 2000);
  };

  const removePlayer = (id) => {
    const player = players.find(p => p.id === id);
    if (rounds.length > 0 && player) {
      const confirmRemove = window.confirm(
        `Remove ${player.name}? Their stats will be preserved for reporting.`
      );
      if (!confirmRemove) return;
    }
    setPlayers((prev) => prev.filter((p) => p.id !== id));
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

  const parseBulk = () => {
    const lines = bulkText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const add = [];
    const normalizeGender = (g) => {
      if (!g) return 'male';
      const s = g.toString().trim().toLowerCase();
      if (['f','female','woman','w'].includes(s)) return 'female';
      if (['m','male','man','men'].includes(s)) return 'male';
      return 'male';
    };
    for (const line of lines) {
      const [name, ratingStr, gender] = line.split(',').map((s) => (s ?? '').trim());
      const rating = Number(ratingStr);
      if (!name || Number.isNaN(rating)) continue;
      add.push({ id: uid(), name, rating, gender: normalizeGender(gender), present: true });
    }
    if (!add.length) return alert('Nothing to add. Use: Name, Rating, Gender');
    setPlayers((prev) => [...prev, ...add]);
    setBulkText('');
  };

  const generateNextRound = () => {
    if (presentPlayers.length < 4) return alert('Need at least 4 present players');
    
    let newRound;
    
    if (tournamentType === 'round_robin') {
      newRound = generateRoundRobinRound(presentPlayers, courts, playerStats, currentRound, separateBySkill);
    } else if (tournamentType === 'king_of_court') {
      newRound = generateKingOfCourtRound(presentPlayers, courts, kotStats, currentRound, rounds, separateBySkill);
    } else {
      return alert('Invalid tournament type');
    }
    
    setRounds(prev => [...prev, newRound]);
    setCurrentRound(prev => prev + 1);
    setLocked(true);
    setTab('schedule');
  };

  const clearAllRounds = () => {
    const confirmClear = window.confirm(
      'Clear all rounds and player statistics? This cannot be undone.'
    );
    if (!confirmClear) return;
    
    setRounds([]);
    setCurrentRound(0);
    setPlayerStats({});
    setKotStats({});
    setLocked(false);
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
    
    if (tournamentType === 'king_of_court' && m.pointsForWin) {
      updateKOTStats(kotStats, m);
      setKotStats({...kotStats});
    }
  };

  const quickWin = (rIdx, mIdx, side) => {
    setRounds((prev) => {
      const newRounds = prev.map((r) => r.map((m) => ({ ...m })));
      const m = newRounds[rIdx][mIdx];

      const s1Empty = m.score1 === '' || m.score1 == null;
      const s2Empty = m.score2 === '' || m.score2 == null;

      if (s1Empty && s2Empty) {
        m.score1 = side === 1 ? 11 : 8;
        m.score2 = side === 2 ? 11 : 8;
      }

      const s1 = typeof m.score1 === 'number' ? m.score1 : Number(m.score1) || 0;
      const s2 = typeof m.score2 === 'number' ? m.score2 : Number(m.score2) || 0;

      if (s1 === s2) {
        alert('Scores are tied. Enter scores or choose a win margin.');
        return prev;
      }

      setWinner(m, side);
      return newRounds;
    });
  };

  const getPlayerStatsDisplay = () => {
    if (tournamentType === 'king_of_court') {
      if (Object.keys(kotStats).length === 0) return null;
      
      const stats = presentPlayers.map(player => {
        const stat = kotStats[player.id] || { totalPoints: 0, court1Wins: 0, currentCourt: null, roundsPlayed: 0 };
        return {
          ...player,
          totalPoints: stat.totalPoints,
          court1Wins: stat.court1Wins,
          currentCourt: stat.currentCourt,
          roundsPlayed: stat.roundsPlayed
        };
      }).sort((a, b) => b.totalPoints - a.totalPoints || b.court1Wins - a.court1Wins);
      
      return stats;
    } else {
      if (Object.keys(playerStats).length === 0) return null;
      
      const stats = presentPlayers.map(player => {
        const stat = playerStats[player.id] || { roundsPlayed: 0, roundsSatOut: 0 };
        return {
          ...player,
          roundsPlayed: stat.roundsPlayed,
          roundsSatOut: stat.roundsSatOut,
          totalRounds: stat.roundsPlayed + stat.roundsSatOut
        };
      }).sort((a, b) => a.roundsSatOut - b.roundsSatOut || b.roundsPlayed - a.roundsPlayed);
      
      return stats;
    }
  };

  return (
    <div className="min-h-screen bg-brand-light pb-28 sm:pb-24">
      {addNote && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[120] bg-brand-secondary text-brand-primary px-3 py-2 rounded-xl shadow">
          {addNote}
        </div>
      )}

      <div className="sticky top-0 z-30 backdrop-blur bg-brand-white/80 border-b border-brand-gray">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary text-brand-white font-bold">
              🏓
            </div>
            <div>
              <div className="text-base font-semibold text-brand-primary">SmashBoard</div>
              <div className="text-xs text-brand-gray">
                {tournamentType === 'king_of_court' ? 'King of Court Mode' : 'Round Robin Mode'}
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px]">
            <span className="rounded-full bg-brand-gray px-2.5 py-1 text-brand-primary">
              Present: <b>{presentPlayers.length}</b>
            </span>
            <span className="rounded-full bg-brand-gray px-2.5 py-1 text-brand-primary">
              Courts: <b>{courts}</b>
            </span>
            <span className="rounded-full bg-brand-gray px-2.5 py-1 text-brand-primary">
              Round: <b>{currentRound}</b>
            </span>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-3 sm:px-4">
          <nav className="flex gap-1 overflow-x-auto no-scrollbar snap-x">
            {[
              { k: 'setup', label: 'Setup' },
              { k: 'roster', label: 'Roster' },
              { k: 'schedule', label: 'Schedule' },
              { k: 'stats', label: tournamentType === 'king_of_court' ? 'Leaderboard' : 'Player Stats' }
            ].map(({ k, label }) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`snap-start rounded-t-xl px-3 sm:px-4 py-2 text-sm font-medium whitespace-nowrap ${
                  tab === k
                    ? 'bg-brand-white text-brand-primary border-x border-t border-brand-gray'
                    : 'text-brand-primary/70 hover:text-brand-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 sm:px-4 pt-4 sm:pt-6 space-y-4 sm:space-y-6">
        {tab === 'setup' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <Card>
              <h3 className="text-sm font-semibold text-brand-primary mb-2 sm:mb-3">Session</h3>
              <div className="space-y-3">
                <Field label="Courts">
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={courts}
                    onChange={(e) => setCourts(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full h-11 rounded-lg border border-brand-gray px-3 focus:border-brand-secondary focus:ring-brand-secondary"
                    disabled={locked}
                  />
                </Field>
                <Field label="Tournament style">
                  <select
                    value={tournamentType}
                    onChange={(e) => {
                      if (rounds.length > 0) {
                        if (!window.confirm('Changing tournament type will clear all rounds. Continue?')) return;
                        clearAllRounds();
                      }
                      setTournamentType(e.target.value);
                    }}
                    className="w-full h-11 rounded-lg border border-brand-gray px-3 focus:border-brand-secondary focus:ring-brand-secondary"
                  >
                    <option value="round_robin">Round Robin</option>
                    <option value="king_of_court">King of Court</option>
                  </select>
                </Field>
                <Field label="Skill separation">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={separateBySkill}
                      onChange={(e) => setSeparateBySkill(e.target.checked)}
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
              </div>
              <div className="mt-3 sm:mt-4 grid grid-cols-1 gap-2">
                <Button
                  className="bg-brand-primary text-brand-white hover:bg-brand-primary/90 w-full"
                  onClick={generateNextRound}
                  disabled={presentPlayers.length < 4}
                >
                  Generate Next Round
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
              
              {rounds.length > 0 && tournamentType === 'round_robin' && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-xs text-blue-800">
                    ✓ <strong>Late arrivals/departures handled automatically</strong><br/>
                    Simply check/uncheck "Present" and generate the next round!
                  </div>
                </div>
              )}
              
              {rounds.length > 0 && tournamentType === 'king_of_court' && (
                <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="text-xs text-purple-800">
                    👑 <strong>King of Court Active!</strong><br/>
                    Winners advance up courts, losers drop down. Court 1 = King Court!
                  </div>
                </div>
              )}
            </Card>

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
                  Bulk add (one per line: <em>Name, Rating, Gender</em>)
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

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-brand-white">
                  <tr className="text-left">
                    <th className="p-2 w-12">✓</th>
                    <th className="p-2">Name</th>
                    <th className="p-2 w-20">DUPR</th>
                    <th className="p-2 hidden sm:table-cell">Skill Level</th>
                    <th className="p-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => (
                    <tr key={p.id} className="border-t border-brand-gray/60">
                      <td className="p-2"><input type="checkbox" checked={!!p.present} onChange={() => togglePresent(p.id)} /></td>
                      <td className="p-2">
                        <input value={p.name} onChange={(e) => updatePlayerField(p.id, 'name', e.target.value)} className="w-full min-w-[120px] rounded border border-brand-gray px-2 py-1" />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.1"
                          min="2.0"
                          max="5.5"
                          value={p.rating}
                          onChange={(e) => updatePlayerField(p.id, 'rating', Number(e.target.value))}
                          className="w-16 rounded border border-brand-gray px-2 py-1"
                        />
                      </td>
                      <td className="p-2 hidden sm:table-cell">
                        <span className={`text-xs px-2 py-1 rounded ${getPlayerSkillLevel(p.rating).color}`}>
                          {getPlayerSkillLevel(p.rating).label}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        <button onClick={() => removePlayer(p.id)} className="text-red-600 hover:underline text-xs sm:text-sm">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === 'stats' && (
          <Card>
            <h3 className="text-sm font-semibold text-brand-primary mb-3">
              {tournamentType === 'king_of_court' ? '👑 Leaderboard' : 'Player Statistics'}
            </h3>
            {((tournamentType === 'king_of_court' && Object.keys(kotStats).length === 0) || 
              (tournamentType === 'round_robin' && Object.keys(playerStats).length === 0)) ? (
              <p className="text-brand-primary/70">No rounds generated yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-brand-white">
                    <tr className="text-left">
                      {tournamentType === 'king_of_court' && <th className="p-2">Rank</th>}
                      <th className="p-2">Player</th>
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
                        <td className="p-2 font-medium">{p.name}</td>
                        <td className="p-2">{p.rating}</td>
                        {tournamentType === 'king_of_court' ? (
                          <>
                            <td className="p-2 font-bold text-brand-primary">{p.totalPoints}</td>
                            <td className="p-2">{p.court1Wins}</td>
                            <td className="p-2">
                              {p.currentCourt ? (
                                <span className={`text-xs px-2 py-1 rounded ${
                                  p.currentCourt === 1 ? 'bg-yellow-100 text-yellow-800 font-bold' : 'bg-gray-100 text-gray-700'
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
          <div className="space-y-3 sm:space-y-4">
            {rounds.length === 0 && (
              <Card className="text-center py-8 sm:py-10">
                <div className="text-3xl sm:text-4xl mb-2">🗓️</div>
                <div className="text-base sm:text-lg font-semibold text-brand-primary">No rounds yet</div>
                <p className="text-sm sm:text-base text-brand-primary/80 mt-1">
                  Click "Generate Next Round" to start
                </p>
              </Card>
            )}

            {rounds.map((round, rIdx) => (
              <details key={rIdx} open={rIdx === rounds.length - 1}>
                <summary className="flex items-center justify-between cursor-pointer">
                  <div className="text-sm sm:text-base font-semibold text-brand-primary">Round {rIdx + 1}</div>
                  <div className="text-xs sm:text-sm text-brand-primary/70">
                    Courts: {round.length}
                  </div>
                </summary>

                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                  {round.map((m, i) => (
                    <Card key={m.id} className="relative bg-brand-white">
                      <div className="absolute right-3 top-3 flex items-center gap-2 text-[11px] sm:text-xs text-brand-primary/60">
                        <span>Diff {m.diff?.toFixed?.(2) ?? '--'}</span>
                        {m.courtLevel && (
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            m.courtLevel === 'KING' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {m.courtLevel === 'KING' ? '👑 KING' : m.courtLevel}
                          </span>
                        )}
                        {m.skillLevel && !m.courtLevel && (
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            m.skillLevel === 'Beginner' ? 'bg-red-100 text-red-700' :
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

                      <div className="text-[11px] sm:text-xs font-medium text-brand-primary/70 flex items-center gap-2">
                        <span>Court {m.court}</span>
                        {m.pointsForWin && (
                          <span className="text-brand-secondary font-bold">
                            {m.pointsForWin} pts/win
                          </span>
                        )}
                      </div>

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

                      <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
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

                        {m.status !== 'completed' ? (
                          <div className="grid grid-cols-2 gap-2 sm:flex">
                            <Button className="bg-brand-secondary text-brand-primary hover:bg-brand-secondary/80 w-full sm:w-auto" onClick={() => quickWin(rIdx, i, 1)}>
                              Team 1 wins
                            </Button>
                            <Button className="bg-brand-secondary text-brand-primary hover:bg-brand-secondary/80 w-full sm:w-auto" onClick={() => quickWin(rIdx, i, 2)}>
                              Team 2 wins
                            </Button>
                          </div>
                        ) : (
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
            ))}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-brand-gray bg-brand-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3 text-sm">
          <div className="hidden sm:flex flex-wrap items-center gap-2 text-brand-primary">
            <span className="rounded-full bg-brand-gray px-3 py-1">Present <b>{presentPlayers.length}</b></span>
            <span className="rounded-full bg-brand-gray px-3 py-1">Round <b>{currentRound}</b></span>
          </div>
          <div className="w-full sm:w-auto">
            <div className="grid grid-cols-1 sm:flex gap-2">
              <InstallPrompt className="w-full sm:w-auto" />
              <Button className="bg-brand-secondary text-brand-primary hover:bg-brand-secondary/90 w-full sm:w-auto" onClick={() => setEndOpen(true)}>
                End Session
              </Button>
              <Button
                className="bg-brand-primary text-brand-white hover:bg-brand-primary/90 w-full sm:w-auto"
                onClick={generateNextRound}
                disabled={presentPlayers.length < 4}
              >
                Next Round
              </Button>
            </div>
          </div>
        </div>
      </div>

      {endOpen && (
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
                    tournamentType === 'king_of_court' ? kotStats : null
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
              <Button className="bg-brand-gray text-brand-primary hover:bg-brand-gray/80 w-full" onClick={() => setEndOpen(false)}>
                Keep Editing
              </Button>
              <Button
                className="bg-brand-primary text-brand-white hover:bg-brand-primary/90 w-full"
                onClick={() => {
                  if (!exportedThisSession && window.confirm('Clear all data? This cannot be undone.')) {
                    setPlayers([]);
                    setRounds([]);
                    setPlayerStats({});
                    setKotStats({});
                    setCurrentRound(0);
                    setExportedThisSession(false);
                    setLocked(false);
                    localStorage.removeItem('pb_session');
                    localStorage.removeItem('pb_roster');
                    setEndOpen(false);
                    setTab('setup');
                  }
                }}
              >
                End & Clear
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PickleballTournamentManager;