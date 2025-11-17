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
        game1Score1: m.game1Score1 || '',
        game1Score2: m.game1Score2 || '',
        game2Score1: m.game2Score1 || '',
        game2Score2: m.game2Score2 || '',
        game3Score1: m.game3Score1 || '',
        game3Score2: m.game3Score2 || '',
        matchFormat: m.matchFormat || 'single_match',
        status: m.status,
        winner: m.winner || null,
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
    'round','court','court_level','game_format',
    't1_p1','t1_p1_rating','t1_p2','t1_p2_rating',
    't2_p1','t2_p1_rating','t2_p2','t2_p2_rating',
    'match_format','games_won_t1','games_won_t2',
    'game1_t1','game1_t2','game2_t1','game2_t2','game3_t1','game3_t2',
    'winner','points_awarded','start_time','end_time','duration_minutes'
  ];
  const rows = results.matches.map((m) =>
    [
      m.round, m.court, m.courtLevel || '', m.gameFormat,
      m.team1?.[0]?.name || '', m.team1?.[0]?.rating || '',
      m.team1?.[1]?.name || '', m.team1?.[1]?.rating || '',
      m.team2?.[0]?.name || '', m.team2?.[0]?.rating || '',
      m.team2?.[1]?.name || '', m.team2?.[1]?.rating || '',
      m.matchFormat,
      m.score1, m.score2,
      m.game1Score1, m.game1Score2,
      m.game2Score1, m.game2Score2,
      m.game3Score1, m.game3Score2,
      m.winner || '', m.pointsAwarded || '',
      m.startTime || '', m.endTime || '', m.durationMinutes || ''
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
      rating: p.rating,
      played: stats.roundsPlayed,
      satOut: stats.roundsSatOut
    };
  });

  // Check for players who haven't played at all
  const notPlayed = playStats.filter(s => s.played === 0);
  if (notPlayed.length > 0 && currentRound >= 2) {
    console.error(`🚨 CRITICAL FAIRNESS ISSUE: ${notPlayed.length} player(s) have NOT played ANY games after ${currentRound + 1} rounds!`);
    notPlayed.forEach(p => {
      console.error(`   ❌ ${p.name} (${p.rating}) - 0 games played, ${p.satOut} sat out`);
    });
  }

  const maxSatOut = Math.max(...playStats.map(s => s.satOut));
  const minSatOut = Math.min(...playStats.map(s => s.satOut));
  const difference = maxSatOut - minSatOut;

  if (difference > 2) {
    console.warn('⚠️ FAIRNESS ALERT: Significant sit-out imbalance');
    console.log('Max sat out:', maxSatOut, 'Min sat out:', minSatOut);
    console.log('Players sitting out most:', playStats.filter(s => s.satOut === maxSatOut).map(s => s.name));
  }
  
  return difference <= 1;
};

const generateRoundRobinRound = (presentPlayers, courts, playerStats, currentRoundIndex, separateBySkill = true, matchFormat = 'single_match') => {
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
      game1Score1: '',
      game1Score2: '',
      game2Score1: '',
      game2Score2: '',
      game3Score1: '',
      game3Score2: '',
      status: 'pending',
      winner: null,
      skillLevel: groupType,
      gameFormat: 'doubles',
      matchFormat: matchFormat
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

/* =====================  SINGLES ROUND ROBIN SCHEDULING  ===================== */

const generateSinglesRound = (presentPlayers, courts, playerStats, currentRoundIndex, matchFormat = 'single_match') => {
  console.log(`\n=== GENERATING SINGLES ROUND ${currentRoundIndex + 1} ===`);
  console.log(`Present players: ${presentPlayers.length}`);

  const updatedStats = initializePlayerStats(playerStats, presentPlayers);
  const maxPlayersPerRound = courts * 2; // Each court has 2 singles players

  // Select players based on fairness (who sat out most)
  const playersThisRound = selectPlayersForRound(presentPlayers, updatedStats, maxPlayersPerRound, currentRoundIndex);

  console.log(`Playing: ${playersThisRound.map(p => p.name).join(', ')}`);
  console.log(`Sitting: ${presentPlayers.filter(p => !playersThisRound.includes(p)).map(p => p.name).join(', ')}`);

  // Create singles matches
  const matches = [];
  const usedPlayers = new Set();

  for (let courtIdx = 0; courtIdx < courts; courtIdx++) {
    const remaining = playersThisRound.filter(p => !usedPlayers.has(p.id));
    if (remaining.length < 2) break;

    // Find best pair by rating similarity
    let bestPair = null;
    let smallestDiff = Infinity;

    for (let i = 0; i < remaining.length - 1; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const diff = Math.abs(remaining[i].rating - remaining[j].rating);
        if (diff < smallestDiff) {
          smallestDiff = diff;
          bestPair = [remaining[i], remaining[j]];
        }
      }
    }

    if (bestPair) {
      usedPlayers.add(bestPair[0].id);
      usedPlayers.add(bestPair[1].id);

      matches.push({
        id: uid(),
        court: courtIdx + 1,
        player1: bestPair[0],
        player2: bestPair[1],
        diff: Math.abs(bestPair[0].rating - bestPair[1].rating),
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
        matchFormat: matchFormat
      });
    }
  }

  updatePlayerStatsForSinglesRound(updatedStats, presentPlayers, matches, currentRoundIndex);
  Object.assign(playerStats, updatedStats);

  console.log(`\n=== SINGLES ROUND ${currentRoundIndex + 1} SUMMARY ===`);
  console.log(`Courts used: ${matches.length}`);
  console.log(`Players playing: ${matches.length * 2}`);
  console.log(`Players sitting: ${presentPlayers.length - matches.length * 2}`);

  return matches;
};

const updatePlayerStatsForSinglesRound = (playerStats, presentPlayers, matches, roundIdx) => {
  const playingIds = new Set();

  matches.forEach(match => {
    playingIds.add(match.player1.id);
    playingIds.add(match.player2.id);
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

  // Track opponents
  matches.forEach(match => {
    const { player1, player2 } = match;
    if (!playerStats[player1.id].opponents) playerStats[player1.id].opponents = new Map();
    if (!playerStats[player2.id].opponents) playerStats[player2.id].opponents = new Map();

    playerStats[player1.id].opponents.set(player2.id, (playerStats[player1.id].opponents.get(player2.id) || 0) + 1);
    playerStats[player2.id].opponents.set(player1.id, (playerStats[player2.id].opponents.get(player1.id) || 0) + 1);
  });
};

/* =====================  TEAMED DOUBLES ROUND ROBIN SCHEDULING  ===================== */

const generateTeamedDoublesRound = (teams, courts, teamStats, currentRoundIndex, matchFormat = 'single_match') => {
  console.log(`\n=== GENERATING TEAMED DOUBLES ROUND ${currentRoundIndex + 1} ===`);
  console.log(`Total teams: ${teams.length}`);

  // Initialize team stats if needed
  teams.forEach(team => {
    if (!teamStats[team.id]) {
      teamStats[team.id] = {
        roundsPlayed: 0,
        roundsSatOut: 0,
        lastPlayedRound: -1,
        opponents: new Map()
      };
    }
  });

  // Separate teams by gender type
  const maleTeams = teams.filter(t => t.gender === 'male_male');
  const femaleTeams = teams.filter(t => t.gender === 'female_female');
  const mixedTeams = teams.filter(t => t.gender === 'mixed');

  console.log(`Male teams: ${maleTeams.length}, Female teams: ${femaleTeams.length}, Mixed teams: ${mixedTeams.length}`);

  const matches = [];
  const usedTeams = new Set();
  let courtIdx = 0;

  // Function to create matches for a gender group
  const createMatchesForGender = (genderTeams, genderLabel) => {
    if (genderTeams.length < 2) {
      console.log(`Not enough ${genderLabel} teams (need 2, have ${genderTeams.length})`);
      return;
    }

    // Determine how many teams can play based on available courts
    const availableCourts = courts - courtIdx;
    const maxTeamsForGender = Math.min(genderTeams.length, availableCourts * 2);

    // Select teams based on fairness
    const selectedTeams = selectTeamsForRound(genderTeams, teamStats, maxTeamsForGender, currentRoundIndex);

    console.log(`${genderLabel} - Playing: ${selectedTeams.map(t => `${t.player1.name}/${t.player2.name}`).join(', ')}`);

    // Create matches within this gender group
    const remainingTeams = [...selectedTeams];

    while (remainingTeams.length >= 2 && courtIdx < courts) {
      // Find best matchup by rating similarity
      let bestMatch = null;
      let smallestDiff = Infinity;

      for (let i = 0; i < remainingTeams.length - 1; i++) {
        for (let j = i + 1; j < remainingTeams.length; j++) {
          const diff = Math.abs(remainingTeams[i].avgRating - remainingTeams[j].avgRating);
          // Prefer teams that haven't played each other
          const playedBefore = teamStats[remainingTeams[i].id].opponents.get(remainingTeams[j].id) || 0;
          const adjustedDiff = diff + (playedBefore * 2); // Penalty for repeat matchups

          if (adjustedDiff < smallestDiff) {
            smallestDiff = adjustedDiff;
            bestMatch = [remainingTeams[i], remainingTeams[j]];
          }
        }
      }

      if (bestMatch) {
        usedTeams.add(bestMatch[0].id);
        usedTeams.add(bestMatch[1].id);

        matches.push({
          id: uid(),
          court: courtIdx + 1,
          team1: [bestMatch[0].player1, bestMatch[0].player2],
          team2: [bestMatch[1].player1, bestMatch[1].player2],
          team1Id: bestMatch[0].id,
          team2Id: bestMatch[1].id,
          teamGender: bestMatch[0].gender, // Track gender type in match
          diff: Math.abs(bestMatch[0].avgRating - bestMatch[1].avgRating),
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
          matchFormat: matchFormat
        });

        // Remove used teams from remaining
        remainingTeams.splice(remainingTeams.indexOf(bestMatch[0]), 1);
        remainingTeams.splice(remainingTeams.indexOf(bestMatch[1]), 1);

        courtIdx++;
      } else {
        break; // No more valid matches
      }
    }
  };

  // Create matches for each gender group
  createMatchesForGender(maleTeams, 'Male/Male');
  createMatchesForGender(femaleTeams, 'Female/Female');
  createMatchesForGender(mixedTeams, 'Mixed');

  updateTeamStatsForRound(teamStats, teams, matches, currentRoundIndex);

  console.log(`\n=== TEAMED DOUBLES ROUND ${currentRoundIndex + 1} SUMMARY ===`);
  console.log(`Courts used: ${matches.length}`);
  console.log(`Teams playing: ${matches.length * 2}`);
  console.log(`Teams sitting: ${teams.length - matches.length * 2}`);

  return matches;
};

const selectTeamsForRound = (allTeams, teamStats, maxTeams, roundIdx) => {
  if (allTeams.length <= maxTeams) {
    return [...allTeams];
  }

  const teamPriority = allTeams.map(team => {
    const stats = teamStats[team.id] || { roundsPlayed: 0, roundsSatOut: 0, lastPlayedRound: -1 };
    let priority = 0;

    priority += stats.roundsSatOut * 500;

    if (stats.lastPlayedRound >= 0) {
      priority += (roundIdx - stats.lastPlayedRound) * 200;
    } else {
      priority += 1000;
    }

    const avgRoundsPlayed = roundIdx > 0 ?
      Object.values(teamStats).reduce((sum, s) => sum + (s.roundsPlayed || 0), 0) / Object.keys(teamStats).length : 0;
    priority += (avgRoundsPlayed - stats.roundsPlayed) * 100;

    priority += Math.random() * 1;

    return { team, priority, stats };
  });

  return teamPriority
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxTeams)
    .map(item => item.team);
};

const updateTeamStatsForRound = (teamStats, allTeams, matches, roundIdx) => {
  const playingIds = new Set();

  matches.forEach(match => {
    playingIds.add(match.team1Id);
    playingIds.add(match.team2Id);
  });

  allTeams.forEach(team => {
    const stats = teamStats[team.id];
    if (playingIds.has(team.id)) {
      stats.roundsPlayed++;
      stats.lastPlayedRound = roundIdx;
    } else {
      stats.roundsSatOut++;
    }
  });

  // Track opponents
  matches.forEach(match => {
    teamStats[match.team1Id].opponents.set(match.team2Id, (teamStats[match.team1Id].opponents.get(match.team2Id) || 0) + 1);
    teamStats[match.team2Id].opponents.set(match.team1Id, (teamStats[match.team2Id].opponents.get(match.team1Id) || 0) + 1);
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
      game1Score1: '',
      game1Score2: '',
      game2Score1: '',
      game2Score2: '',
      game3Score1: '',
      game3Score2: '',
      status: 'pending',
      winner: null,
      skillLevel: groupLabel,
      pointsForWin: courtPoints,
      gameFormat: 'doubles',
      matchFormat: 'single_match'
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

/* =====================  KING OF COURT - TEAMED DOUBLES  ===================== */

const initializeKingOfCourtTeamStats = (kotTeamStats, presentTeams, courts) => {
  const updatedStats = { ...kotTeamStats };

  presentTeams.forEach(team => {
    if (!updatedStats[team.id]) {
      console.log(`NEW KOT TEAM: ${team.player1.name}/${team.player2.name} - assigning to court`);
      updatedStats[team.id] = {
        team: team,
        totalPoints: 0,
        court1Wins: 0,
        currentCourt: null,
        courtHistory: [],
        roundsPlayed: 0,
        roundsSatOut: 0,
        lastPlayedRound: -1
      };
    } else {
      updatedStats[team.id].team = team;
    }
  });

  return updatedStats;
};

const selectTeamsForKOTRound = (allTeams, kotTeamStats, maxTeams, roundIdx) => {
  if (allTeams.length <= maxTeams) {
    return [...allTeams];
  }

  console.log(`\n=== KOT TEAM SELECTION (Round ${roundIdx + 1}) ===`);

  const teamPriority = allTeams.map(team => {
    const stats = kotTeamStats[team.id] || { roundsPlayed: 0, roundsSatOut: 0, lastPlayedRound: -1 };
    let priority = 0;

    // HIGHEST priority for sitting out
    priority += stats.roundsSatOut * 500;
    console.log(`${team.player1.name}/${team.player2.name}: sat out ${stats.roundsSatOut} rounds (+${stats.roundsSatOut * 500})`);

    // SECOND priority: Haven't played recently
    const roundsSincePlay = roundIdx - stats.lastPlayedRound;
    priority += roundsSincePlay * 100;
    console.log(`  → ${roundsSincePlay} rounds since play (+${roundsSincePlay * 100})`);

    // Tie-breaker: fewer games played
    priority += (100 - stats.roundsPlayed) * 10;
    console.log(`  → ${stats.roundsPlayed} rounds played (+${(100 - stats.roundsPlayed) * 10})`);

    console.log(`  → TOTAL PRIORITY: ${priority}`);

    return { team, priority };
  });

  teamPriority.sort((a, b) => b.priority - a.priority);

  const selectedTeams = teamPriority.slice(0, maxTeams).map(tp => tp.team);
  console.log(`Selected teams: ${selectedTeams.map(t => `${t.player1.name}/${t.player2.name}`).join(', ')}`);

  return selectedTeams;
};

const assignTeamsToCourts = (groupTeams, kotTeamStats, previousRounds, roundIndex, numCourts, startingCourtIndex) => {
  if (previousRounds.length === 0) return groupTeams;

  const lastRound = previousRounds[previousRounds.length - 1];
  const teamResults = [];

  groupTeams.forEach(team => {
    let won = false;
    let lastCourt = null;

    lastRound.forEach(match => {
      if (match.status === 'completed') {
        const isTeam1 = match.team1Id === team.id;
        const isTeam2 = match.team2Id === team.id;

        if (isTeam1 || isTeam2) {
          lastCourt = match.court;
          if ((isTeam1 && match.winner === 'team1') || (isTeam2 && match.winner === 'team2')) {
            won = true;
          }
        }
      }
    });

    const stats = kotTeamStats[team.id] || { totalPoints: 0, currentCourt: null };

    teamResults.push({
      team,
      won,
      lastCourt: lastCourt || startingCourtIndex + numCourts - 1,
      totalPoints: stats.totalPoints || 0
    });
  });

  teamResults.sort((a, b) => {
    if (a.lastCourt !== b.lastCourt) {
      return a.lastCourt - b.lastCourt;
    }
    if (a.won !== b.won) {
      return a.won ? -1 : 1;
    }
    return b.totalPoints - a.totalPoints;
  });

  const sortedTeams = [];

  for (let courtIdx = 0; courtIdx < numCourts; courtIdx++) {
    const courtNumber = startingCourtIndex + courtIdx;

    const winnersFromThisCourt = teamResults.filter(tr =>
      tr.lastCourt === courtNumber && tr.won
    ).map(tr => tr.team);

    const winnersFromBelowCourt = courtIdx < numCourts - 1 ?
      teamResults.filter(tr =>
        tr.lastCourt === courtNumber + 1 && tr.won
      ).map(tr => tr.team).slice(0, 1) : []; // Only 1 team moves up

    const losersFromThisCourt = teamResults.filter(tr =>
      tr.lastCourt === courtNumber && !tr.won
    ).map(tr => tr.team);

    let courtTeams = [...winnersFromThisCourt];

    if (courtIdx === 0) {
      courtTeams.push(...winnersFromBelowCourt);
    }

    while (courtTeams.length < 2 && losersFromThisCourt.length > 0) {
      courtTeams.push(losersFromThisCourt.shift());
    }

    if (courtTeams.length < 2) {
      const available = teamResults
        .filter(tr => !sortedTeams.includes(tr.team))
        .map(tr => tr.team);

      while (courtTeams.length < 2 && available.length > 0) {
        courtTeams.push(available.shift());
      }
    }

    sortedTeams.push(...courtTeams.slice(0, 2));
  }

  const remaining = groupTeams.filter(t => !sortedTeams.includes(t));
  sortedTeams.push(...remaining);

  return sortedTeams;
};

const generateKOTMatchesForTeamGroup = (groupTeams, kotTeamStats, numCourts, startingCourtIndex, roundIndex, previousRounds, groupLabel, courtsInHierarchy) => {
  const matches = [];
  const teamsPerCourt = 2;
  const totalTeams = groupTeams.length;
  const actualCourts = Math.min(numCourts, Math.floor(totalTeams / teamsPerCourt));
  const maxTeamsThisRound = actualCourts * 2;

  console.log(`${groupLabel}: courtsInHierarchy=${courtsInHierarchy}, actualCourts=${actualCourts}`);

  let teamsToAssign = [...groupTeams];

  // PRIORITY-BASED SELECTION: If we have more teams than spots, select fairly
  if (totalTeams > maxTeamsThisRound) {
    console.log(`${groupLabel}: Selecting ${maxTeamsThisRound} of ${totalTeams} teams using priority system`);
    teamsToAssign = selectTeamsForKOTRound(groupTeams, kotTeamStats, maxTeamsThisRound, roundIndex);
    console.log(`${groupLabel} - Playing: ${teamsToAssign.map(t => `${t.player1.name}/${t.player2.name}`).join(', ')}`);
    console.log(`${groupLabel} - Sitting out: ${groupTeams.filter(t => !teamsToAssign.includes(t)).map(t => `${t.player1.name}/${t.player2.name}`).join(', ')}`);
  }

  let teamPool = [...teamsToAssign];

  if (roundIndex === 0) {
    console.log(`First KOT round for ${groupLabel} - random assignment`);
    teamPool = teamPool.sort(() => Math.random() - 0.5);
  } else {
    console.log(`KOT advancement for ${groupLabel} - sorting by previous round results`);
    teamPool = assignTeamsToCourts(teamsToAssign, kotTeamStats, previousRounds, roundIndex, actualCourts, startingCourtIndex);
  }

  for (let courtIdx = 0; courtIdx < actualCourts; courtIdx++) {
    const courtNumber = startingCourtIndex + courtIdx;
    const teamsForCourt = teamPool.slice(courtIdx * 2, (courtIdx + 1) * 2);

    if (teamsForCourt.length < 2) break;

    teamsForCourt.forEach(team => {
      if (kotTeamStats[team.id]) {
        kotTeamStats[team.id].currentCourt = courtNumber;
        kotTeamStats[team.id].courtHistory.push(courtNumber);
        kotTeamStats[team.id].roundsPlayed++;
        kotTeamStats[team.id].lastPlayedRound = roundIndex;
      }
    });

    // Calculate points based on position in THIS hierarchy
    const courtPoints = getCourtPoints(courtIdx, courtsInHierarchy);

    console.log(`  Court ${courtNumber} (index ${courtIdx} in hierarchy): ${courtPoints} pts/win`);

    matches.push({
      id: uid(),
      court: courtNumber,
      courtLevel: courtIdx === 0 ? 'KING' : `Level ${courtIdx + 1}`,
      team1: [teamsForCourt[0].player1, teamsForCourt[0].player2],
      team2: [teamsForCourt[1].player1, teamsForCourt[1].player2],
      team1Id: teamsForCourt[0].id,
      team2Id: teamsForCourt[1].id,
      teamGender: teamsForCourt[0].gender,
      diff: Math.abs(teamsForCourt[0].avgRating - teamsForCourt[1].avgRating),
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
      matchFormat: 'single_match',
      pointsForWin: courtPoints,
      startTime: new Date().toISOString()
    });
  }

  // Update roundsSatOut for teams not playing
  const sittingTeams = groupTeams.filter(t => !teamsToAssign.includes(t));
  sittingTeams.forEach(team => {
    if (kotTeamStats[team.id]) {
      kotTeamStats[team.id].roundsSatOut++;
    }
  });

  return matches;
};

const generateKingOfCourtTeamedRound = (presentTeams, courts, kotTeamStats, currentRoundIndex, previousRounds, separateBySkill) => {
  console.log(`\n=== GENERATING KING OF COURT TEAMED ROUND ${currentRoundIndex + 1} ===`);

  const updatedStats = initializeKingOfCourtTeamStats(kotTeamStats, presentTeams, courts);
  const matches = [];

  if (separateBySkill && presentTeams.length >= 4) {
    // Group teams by gender type
    const maleTeams = presentTeams.filter(t => t.gender === 'male_male');
    const femaleTeams = presentTeams.filter(t => t.gender === 'female_female');
    const mixedTeams = presentTeams.filter(t => t.gender === 'mixed');

    let globalCourtIndex = 1;

    [
      { teams: maleTeams, label: 'Male/Male' },
      { teams: femaleTeams, label: 'Female/Female' },
      { teams: mixedTeams, label: 'Mixed' }
    ].forEach(({ teams, label }) => {
      if (teams.length >= 2) {
        const groupCourts = Math.floor(teams.length / 2);
        const actualCourts = Math.min(groupCourts, courts - globalCourtIndex + 1);

        if (actualCourts > 0) {
          console.log(`\n${label}: ${teams.length} teams, ${actualCourts} courts (starting at Court ${globalCourtIndex})`);

          const groupMatches = generateKOTMatchesForTeamGroup(
            teams,
            updatedStats,
            actualCourts,
            globalCourtIndex,
            currentRoundIndex,
            previousRounds,
            label,
            actualCourts
          );

          matches.push(...groupMatches);
          globalCourtIndex += groupMatches.length;
        }
      }
    });
  } else {
    const groupMatches = generateKOTMatchesForTeamGroup(
      presentTeams,
      updatedStats,
      courts,
      1,
      currentRoundIndex,
      previousRounds,
      'All Teams',
      courts
    );
    matches.push(...groupMatches);
  }

  Object.assign(kotTeamStats, updatedStats);

  console.log(`\n=== KOT TEAMED ROUND ${currentRoundIndex + 1} SUMMARY ===`);
  console.log(`Courts used: ${matches.length}`);
  console.log(`Teams playing: ${matches.reduce((sum, m) => sum + 2, 0)}`);

  return matches;
};

const updateKOTTeamStats = (kotTeamStats, match) => {
  if (match.status !== 'completed' || !match.winner) return;

  const winningTeamId = match.winner === 'team1' ? match.team1Id : match.team2Id;
  const points = match.pointsForWin || 0;

  if (kotTeamStats[winningTeamId]) {
    kotTeamStats[winningTeamId].totalPoints += points;

    if (match.courtLevel === 'KING') {
      kotTeamStats[winningTeamId].court1Wins++;
    }
  }
};

/* =====================  KING OF COURT - AUTO TEAM GENERATION  ===================== */

const generateBalancedKOTTeams = (players) => {
  if (players.length < 2) return [];

  // Sort players by rating (highest to lowest)
  const sortedPlayers = [...players].sort((a, b) => Number(b.rating) - Number(a.rating));

  const teams = [];
  const numTeams = Math.floor(players.length / 2);

  // Use snake draft to balance teams
  // Round 1: Pick strongest players (team1: p1, team2: p2, team3: p3, ...)
  // Round 2: Pick in reverse (team3: p4, team2: p5, team1: p6, ...)

  const teamSlots = Array(numTeams).fill(null).map(() => ({ player1: null, player2: null }));

  let currentTeam = 0;
  let direction = 1; // 1 for forward, -1 for reverse

  for (let i = 0; i < sortedPlayers.length; i++) {
    const player = sortedPlayers[i];

    // Assign to current team
    if (teamSlots[currentTeam].player1 === null) {
      teamSlots[currentTeam].player1 = player;
    } else if (teamSlots[currentTeam].player2 === null) {
      teamSlots[currentTeam].player2 = player;
    }

    // Move to next team
    if (direction === 1) {
      currentTeam++;
      if (currentTeam >= numTeams) {
        currentTeam = numTeams - 1;
        direction = -1;
      }
    } else {
      currentTeam--;
      if (currentTeam < 0) {
        currentTeam = 0;
        direction = 1;
      }
    }
  }

  // Create team objects
  teamSlots.forEach((slot, idx) => {
    if (slot.player1 && slot.player2) {
      const p1Rating = Number(slot.player1.rating);
      const p2Rating = Number(slot.player2.rating);
      const avgRating = (p1Rating + p2Rating) / 2;

      // Determine gender
      let gender = 'mixed';
      if (slot.player1.gender === 'male' && slot.player2.gender === 'male') {
        gender = 'male_male';
      } else if (slot.player1.gender === 'female' && slot.player2.gender === 'female') {
        gender = 'female_female';
      }

      teams.push({
        id: uid(),
        player1: slot.player1,
        player2: slot.player2,
        avgRating: avgRating,
        gender: gender,
        isAutoGenerated: true
      });
    }
  });

  return teams;
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
  const [gameFormat, setGameFormat] = useState('doubles'); // doubles, teamed_doubles, singles
  const [matchFormat, setMatchFormat] = useState('single_match'); // single_match, best_of_3
  const [teams, setTeams] = useState([]); // For teamed doubles: [{id, player1, player2, gender}]
  const [kotAutoTeams, setKotAutoTeams] = useState([]); // For King of Court auto-generated fixed teams
  const [separateBySkill, setSeparateBySkill] = useState(true);

  const [rounds, setRounds] = useState([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [playerStats, setPlayerStats] = useState({});
  const [kotStats, setKotStats] = useState({});
  const [kotTeamStats, setKotTeamStats] = useState({}); // For King of Court with teams
  const [teamStats, setTeamStats] = useState({}); // For teamed doubles
  const [courtStates, setCourtStates] = useState([]); // Court flow management: [{courtNumber, status, currentMatch}]

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

  // Initialize court states when courts number changes
  useEffect(() => {
    const newCourtStates = Array.from({ length: courts }, (_, i) => ({
      courtNumber: i + 1,
      status: 'ready', // ready, playing, cleaning
      currentMatch: null
    }));
    setCourtStates(newCourtStates);
  }, [courts]);

  useEffect(() => {
    const snapshot = {
      players, rounds, playerStats, kotStats, teamStats, currentRound, teams, courtStates,
      meta: { courts, sessionMinutes, minutesPerRound, tournamentType, gameFormat, matchFormat, separateBySkill, ts: Date.now() },
      locked
    };
    localStorage.setItem('pb_session', JSON.stringify(snapshot));
  }, [players, rounds, playerStats, kotStats, teamStats, currentRound, teams, courtStates, courts, sessionMinutes, minutesPerRound, tournamentType, gameFormat, matchFormat, separateBySkill, locked]);

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
      if (court.status === 'playing' && court.currentMatch) {
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
      if (court.status === 'playing' && court.currentMatch) {
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

  // Get next-up queue based on fairness
  const getNextUpQueue = useMemo(() => {
    if (tournamentType === 'round_robin') {
      if (gameFormat === 'singles') {
        // Singles: prioritize players by sat-out rounds
        return availablePlayers
          .map(p => {
            const stats = playerStats[p.id] || { roundsPlayed: 0, roundsSatOut: 0 };
            return { ...p, ...stats, priority: stats.roundsSatOut * 100 + (10 - stats.roundsPlayed) };
          })
          .sort((a, b) => b.priority - a.priority);
      } else if (gameFormat === 'teamed_doubles') {
        // Teamed doubles: prioritize teams by sat-out rounds
        return availableTeams
          .map(t => {
            const stats = teamStats[t.id] || { roundsPlayed: 0, roundsSatOut: 0 };
            return { ...t, ...stats, priority: stats.roundsSatOut * 100 + (10 - stats.roundsPlayed) };
          })
          .sort((a, b) => b.priority - a.priority);
      } else {
        // Regular doubles: prioritize players by sat-out rounds
        return availablePlayers
          .map(p => {
            const stats = playerStats[p.id] || { roundsPlayed: 0, roundsSatOut: 0 };
            return { ...p, ...stats, priority: stats.roundsSatOut * 100 + (10 - stats.roundsPlayed) };
          })
          .sort((a, b) => b.priority - a.priority);
      }
    }
    return [];
  }, [tournamentType, gameFormat, availablePlayers, availableTeams, playerStats, teamStats]);

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

  // Court Flow Management Functions
  const assignMatchToCourt = (courtNumber) => {
    if (tournamentType === 'round_robin') {
      if (gameFormat === 'singles') {
        assignSinglesMatchToCourt(courtNumber);
      } else if (gameFormat === 'teamed_doubles') {
        assignTeamedDoublesMatchToCourt(courtNumber);
      } else {
        assignDoublesMatchToCourt(courtNumber);
      }
    } else if (tournamentType === 'king_of_court') {
      alert('King of Court mode uses full round generation. Use "Generate Next Round" instead.');
    }
  };

  const assignSinglesMatchToCourt = (courtNumber) => {
    if (availablePlayers.length < 2) {
      return alert('Need at least 2 available players (not currently playing)');
    }

    // Sort by priority (players who have played least)
    const sortedAvailable = [...availablePlayers].sort((a, b) => {
      const statsA = playerStats[a.id] || { roundsPlayed: 0, roundsSatOut: 0 };
      const statsB = playerStats[b.id] || { roundsPlayed: 0, roundsSatOut: 0 };
      return statsA.roundsPlayed - statsB.roundsPlayed || statsB.roundsSatOut - statsA.roundsSatOut;
    });

    let player1, player2;

    // Apply skill separation if enabled
    if (separateBySkill && presentPlayers.length >= 8) {
      // Start with the highest priority player
      player1 = sortedAvailable[0];

      // Filter for players who can play with player1 (within ±1 skill level)
      const compatiblePlayers = sortedAvailable.slice(1).filter(p => canPlayTogether(player1, p));

      if (compatiblePlayers.length > 0) {
        // Select the highest priority compatible player
        player2 = compatiblePlayers[0];
      } else {
        // No compatible players, fall back to next available
        console.warn('No skill-compatible players for singles match, using mixed pairing');
        player2 = sortedAvailable[1];
      }
    } else {
      // No skill separation, use traditional pairing
      player1 = sortedAvailable[0];
      player2 = sortedAvailable[1];
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

    // Initialize player stats if needed
    setPlayerStats(prev => {
      const updated = { ...prev };
      if (!updated[player1.id]) {
        updated[player1.id] = {
          roundsPlayed: 0,
          roundsSatOut: 0,
          lastPlayedRound: -1,
          opponents: new Map(),
          teammates: new Map(),
          totalPlayMinutes: 0
        };
      }
      if (!updated[player2.id]) {
        updated[player2.id] = {
          roundsPlayed: 0,
          roundsSatOut: 0,
          lastPlayedRound: -1,
          opponents: new Map(),
          teammates: new Map(),
          totalPlayMinutes: 0
        };
      }
      return updated;
    });
  };

  const assignDoublesMatchToCourt = (courtNumber) => {
    if (availablePlayers.length < 4) {
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

    // Initialize player stats if needed
    setPlayerStats(prev => {
      const updated = { ...prev };
      [...teamSplit.team1, ...teamSplit.team2].forEach(p => {
        if (!updated[p.id]) {
          updated[p.id] = {
            roundsPlayed: 0,
            roundsSatOut: 0,
            lastPlayedRound: -1,
            opponents: new Map(),
            teammates: new Map(),
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
        const stats1 = teamStats[team1.id] || { opponents: new Map() };

        // Penalty for rating difference (prefer close ratings)
        const ratingDiff = Math.abs(team1.avgRating - team.avgRating);
        score += ratingDiff * 10;

        // Penalty for repeated matchups
        const timesPlayed = stats1.opponents?.get(team.id) || 0;
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

    // Initialize team stats if needed
    setTeamStats(prev => {
      const updated = { ...prev };
      if (!updated[team1.id]) {
        updated[team1.id] = { roundsPlayed: 0, roundsSatOut: 0, lastPlayedRound: -1, opponents: new Map(), totalPlayMinutes: 0 };
      }
      if (!updated[team2.id]) {
        updated[team2.id] = { roundsPlayed: 0, roundsSatOut: 0, lastPlayedRound: -1, opponents: new Map(), totalPlayMinutes: 0 };
      }
      return updated;
    });
  };

  const completeCourtMatch = (courtNumber) => {
    const court = courtStates.find(c => c.courtNumber === courtNumber);
    if (!court || !court.currentMatch) return;

    const match = court.currentMatch;

    // Add match to current round in rounds array
    setRounds(prev => {
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

    // Update player/team stats
    if (match.gameFormat === 'singles') {
      setPlayerStats(prev => {
        const updated = { ...prev };
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
          if (!updated[match.team1Id].opponents) updated[match.team1Id].opponents = new Map();
          if (!updated[match.team2Id].opponents) updated[match.team2Id].opponents = new Map();
          updated[match.team1Id].opponents.set(match.team2Id, (updated[match.team1Id].opponents.get(match.team2Id) || 0) + 1);
          updated[match.team2Id].opponents.set(match.team1Id, (updated[match.team2Id].opponents.get(match.team1Id) || 0) + 1);
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
            if (!updated[p1.id].teammates) updated[p1.id].teammates = new Map();
            if (!updated[p2.id].teammates) updated[p2.id].teammates = new Map();
            updated[p1.id].teammates.set(p2.id, (updated[p1.id].teammates.get(p2.id) || 0) + 1);
            updated[p2.id].teammates.set(p1.id, (updated[p2.id].teammates.get(p1.id) || 0) + 1);
          }
        }

        // Update teammate history for team2
        if (match.team2 && match.team2.length === 2) {
          const [p1, p2] = match.team2;
          if (updated[p1.id] && updated[p2.id]) {
            if (!updated[p1.id].teammates) updated[p1.id].teammates = new Map();
            if (!updated[p2.id].teammates) updated[p2.id].teammates = new Map();
            updated[p1.id].teammates.set(p2.id, (updated[p1.id].teammates.get(p2.id) || 0) + 1);
            updated[p2.id].teammates.set(p1.id, (updated[p2.id].teammates.get(p1.id) || 0) + 1);
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
        // Note: roundsSatOut is not tracked in continuous play mode
        // It only makes sense for traditional round-based generation
        return updated;
      });
    }

    // Free up the court
    setCourtStates(prev => prev.map(c =>
      c.courtNumber === courtNumber
        ? { ...c, status: 'ready', currentMatch: null }
        : c
    ));
  };

  const updateCourtStatus = (courtNumber, status) => {
    setCourtStates(prev => prev.map(c =>
      c.courtNumber === courtNumber
        ? { ...c, status }
        : c
    ));
  };

  const generateNextRound = () => {
    let newRound;

    if (tournamentType === 'round_robin') {
      // Check game format
      if (gameFormat === 'singles') {
        if (presentPlayers.length < 2) return alert('Need at least 2 present players for singles');
        newRound = generateSinglesRound(presentPlayers, courts, playerStats, currentRound, matchFormat);
      } else if (gameFormat === 'teamed_doubles') {
        if (teams.length < 2) return alert('Need at least 2 teams for teamed doubles');
        newRound = generateTeamedDoublesRound(teams, courts, teamStats, currentRound, matchFormat);
      } else {
        // Regular doubles with random pairing
        if (presentPlayers.length < 4) return alert('Need at least 4 present players');
        newRound = generateRoundRobinRound(presentPlayers, courts, playerStats, currentRound, separateBySkill, matchFormat);
      }
    } else if (tournamentType === 'king_of_court') {
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

  // Calculate winner for best of 3 format
  const calculateBestOf3Winner = (m) => {
    console.log('Calculating best of 3 winner for match:', {
      game1: `${m.game1Score1}-${m.game1Score2}`,
      game2: `${m.game2Score1}-${m.game2Score2}`,
      game3: `${m.game3Score1}-${m.game3Score2}`
    });

    let side1Wins = 0;
    let side2Wins = 0;

    // Game 1
    const g1s1 = typeof m.game1Score1 === 'number' ? m.game1Score1 : Number(m.game1Score1) || 0;
    const g1s2 = typeof m.game1Score2 === 'number' ? m.game1Score2 : Number(m.game1Score2) || 0;
    if (g1s1 > g1s2) {
      side1Wins++;
      console.log(`Game 1: Team 1 wins (${g1s1}-${g1s2})`);
    } else if (g1s2 > g1s1) {
      side2Wins++;
      console.log(`Game 1: Team 2 wins (${g1s1}-${g1s2})`);
    }

    // Game 2
    const g2s1 = typeof m.game2Score1 === 'number' ? m.game2Score1 : Number(m.game2Score1) || 0;
    const g2s2 = typeof m.game2Score2 === 'number' ? m.game2Score2 : Number(m.game2Score2) || 0;
    if (g2s1 > g2s2) {
      side1Wins++;
      console.log(`Game 2: Team 1 wins (${g2s1}-${g2s2})`);
    } else if (g2s2 > g2s1) {
      side2Wins++;
      console.log(`Game 2: Team 2 wins (${g2s1}-${g2s2})`);
    }

    // Game 3 (if needed)
    if (side1Wins < 2 && side2Wins < 2) {
      const g3s1 = typeof m.game3Score1 === 'number' ? m.game3Score1 : Number(m.game3Score1) || 0;
      const g3s2 = typeof m.game3Score2 === 'number' ? m.game3Score2 : Number(m.game3Score2) || 0;
      if (g3s1 > g3s2) {
        side1Wins++;
        console.log(`Game 3: Team 1 wins (${g3s1}-${g3s2})`);
      } else if (g3s2 > g3s1) {
        side2Wins++;
        console.log(`Game 3: Team 2 wins (${g3s1}-${g3s2})`);
      }
    }

    console.log(`Total: Team 1 won ${side1Wins} games, Team 2 won ${side2Wins} games`);

    if (side1Wins >= 2) {
      console.log('Winner: Team 1');
      return 1;
    }
    if (side2Wins >= 2) {
      console.log('Winner: Team 2');
      return 2;
    }
    console.log('No winner yet');
    return null; // No winner yet
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
        setKotTeamStats({...kotTeamStats});
      } else {
        updateKOTStats(kotStats, m);
        setKotStats({...kotStats});
      }
    }
  };

  const quickWin = (rIdx, mIdx, side) => {
    setRounds((prev) => {
      const newRounds = prev.map((r) => r.map((m) => ({ ...m })));
      const m = newRounds[rIdx][mIdx];

      // Best of 3 format - require all game scores to be entered manually
      if (m.matchFormat === 'best_of_3') {
        // Check if Game 1 and Game 2 scores are entered
        const g1s1 = Number(m.game1Score1);
        const g1s2 = Number(m.game1Score2);
        const g2s1 = Number(m.game2Score1);
        const g2s2 = Number(m.game2Score2);

        if (!g1s1 || !g1s2 || !g2s1 || !g2s2) {
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
          // 2-0 win - Game 3 should NOT be played, clear it
          m.game3Score1 = '';
          m.game3Score2 = '';

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

      // Single match format - require score to be entered manually
      const s1 = Number(m.score1);
      const s2 = Number(m.score2);

      if (!s1 || !s2) {
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

                <Field label="Game format">
                  <select
                    value={gameFormat}
                    onChange={(e) => {
                      if (rounds.length > 0) {
                        if (!window.confirm('Changing game format will clear all rounds. Continue?')) return;
                        clearAllRounds();
                      }
                      setGameFormat(e.target.value);
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
                      onChange={(e) => setMatchFormat(e.target.value)}
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

        {tab === 'roster' && gameFormat === 'teamed_doubles' && (
          <Card className="mt-3">
            <h3 className="text-sm font-semibold text-brand-primary mb-3">Team Formation</h3>
            <p className="text-xs text-brand-primary/70 mb-3">
              Create fixed teams for the tournament. Teams will play together throughout all rounds.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-3">
              <div className="relative">
                <select
                  value={form.teamPlayer1?.id || ''}
                  onChange={(e) => {
                    const player1Id = e.target.value;
                    if (!player1Id) {
                      setForm(f => ({ ...f, teamPlayer1: null }));
                      return;
                    }
                    const player1 = players.find(p => p.id === player1Id);
                    if (player1) {
                      setForm(f => ({ ...f, teamPlayer1: player1 }));
                    }
                  }}
                  className="h-11 rounded-lg border border-brand-gray px-3 w-full pr-8"
                >
                  <option value="">Select Player 1</option>
                  {players.filter(p => !teams.some(t => t.player1.id === p.id || t.player2.id === p.id) && p.id !== form.teamPlayer2?.id).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.rating})</option>
                  ))}
                </select>
                {form.teamPlayer1 && (
                  <button
                    onClick={() => setForm(f => ({ ...f, teamPlayer1: null }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-red-600 hover:text-red-800 font-bold"
                    title="Clear selection"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="relative">
                <select
                  value={form.teamPlayer2?.id || ''}
                  onChange={(e) => {
                    const player2Id = e.target.value;
                    if (!player2Id) {
                      setForm(f => ({ ...f, teamPlayer2: null }));
                      return;
                    }
                    const player2 = players.find(p => p.id === player2Id);
                    if (player2) {
                      setForm(f => ({ ...f, teamPlayer2: player2 }));
                    }
                  }}
                  className="h-11 rounded-lg border border-brand-gray px-3 w-full pr-8"
                >
                  <option value="">Select Player 2</option>
                  {players.filter(p => !teams.some(t => t.player1.id === p.id || t.player2.id === p.id) && p.id !== form.teamPlayer1?.id).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.rating})</option>
                  ))}
                </select>
                {form.teamPlayer2 && (
                  <button
                    onClick={() => setForm(f => ({ ...f, teamPlayer2: null }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-red-600 hover:text-red-800 font-bold"
                    title="Clear selection"
                  >
                    ✕
                  </button>
                )}
              </div>

              <select
                value={form.teamGender || 'mixed'}
                onChange={(e) => setForm(f => ({ ...f, teamGender: e.target.value }))}
                className="h-11 rounded-lg border border-brand-gray px-3"
              >
                <option value="male_male">Male/Male</option>
                <option value="female_female">Female/Female</option>
                <option value="mixed">Male/Female (Mixed)</option>
              </select>

              <Button
                className="bg-brand-secondary text-brand-primary hover:bg-brand-secondary/80 col-span-2"
                onClick={() => {
                  if (!form.teamPlayer1 || !form.teamPlayer2) {
                    alert('Please select both players');
                    return;
                  }
                  const newTeam = {
                    id: uid(),
                    player1: form.teamPlayer1,
                    player2: form.teamPlayer2,
                    gender: form.teamGender || 'mixed',
                    avgRating: (form.teamPlayer1.rating + form.teamPlayer2.rating) / 2
                  };
                  setTeams([...teams, newTeam]);
                  setForm(f => ({ ...f, teamPlayer1: null, teamPlayer2: null, teamGender: 'mixed' }));
                }}
                disabled={!form.teamPlayer1 || !form.teamPlayer2}
              >
                Add Team
              </Button>
            </div>

            {teams.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-brand-white">
                    <tr className="text-left">
                      <th className="p-2">Team</th>
                      <th className="p-2">Player 1</th>
                      <th className="p-2">Player 2</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Avg Rating</th>
                      <th className="p-2 w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((team, idx) => (
                      <tr key={team.id} className="border-t border-brand-gray/60">
                        <td className="p-2 font-semibold">Team {idx + 1}</td>
                        <td className="p-2">{team.player1.name} ({team.player1.rating})</td>
                        <td className="p-2">{team.player2.name} ({team.player2.rating})</td>
                        <td className="p-2">
                          <span className={`text-xs px-2 py-1 rounded ${
                            team.gender === 'male_male' ? 'bg-blue-100 text-blue-700' :
                            team.gender === 'female_female' ? 'bg-pink-100 text-pink-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {team.gender === 'male_male' ? 'M/M' :
                             team.gender === 'female_female' ? 'F/F' : 'Mixed'}
                          </span>
                        </td>
                        <td className="p-2">{team.avgRating.toFixed(2)}</td>
                        <td className="p-2 text-right">
                          <button onClick={() => setTeams(teams.filter(t => t.id !== team.id))} className="text-red-600 hover:underline text-xs">Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {teams.length > 0 && teams.length < 2 && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="text-xs text-yellow-800">
                  ⚠️ You need at least 2 teams to start a tournament.
                </div>
              </div>
            )}
          </Card>
        )}

        {tab === 'stats' && (
          <Card>
            <h3 className="text-sm font-semibold text-brand-primary mb-3">
              {tournamentType === 'king_of_court' ? '👑 Leaderboard' : 'Player Statistics'}
            </h3>
            {((tournamentType === 'king_of_court' && gameFormat === 'teamed_doubles' && Object.keys(kotTeamStats).length === 0) ||
              (tournamentType === 'king_of_court' && gameFormat !== 'teamed_doubles' && Object.keys(kotStats).length === 0) ||
              (tournamentType === 'round_robin' && Object.keys(playerStats).length === 0)) ? (
              <p className="text-brand-primary/70">No rounds generated yet.</p>
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
            {/* Court Flow Management - Only for Round Robin */}
            {tournamentType === 'round_robin' && (
              <>
                {/* Court Status Grid */}
                <Card>
                  <h3 className="text-sm font-semibold text-brand-primary mb-3">Court Status</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {courtStates.map(court => (
                      <div key={court.courtNumber} className={`p-3 rounded-lg border-2 ${
                        court.status === 'playing' ? 'border-green-500 bg-green-50' :
                        court.status === 'cleaning' ? 'border-yellow-500 bg-yellow-50' :
                        'border-gray-300 bg-gray-50'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-brand-primary">Court {court.courtNumber}</span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            court.status === 'playing' ? 'bg-green-200 text-green-800' :
                            court.status === 'cleaning' ? 'bg-yellow-200 text-yellow-800' :
                            'bg-gray-200 text-gray-800'
                          }`}>
                            {court.status.toUpperCase()}
                          </span>
                        </div>

                        {court.currentMatch && (
                          <div className="text-xs text-brand-primary/80 mb-2">
                            {court.currentMatch.gameFormat === 'singles' ? (
                              <div>{court.currentMatch.player1?.name} vs {court.currentMatch.player2?.name}</div>
                            ) : (
                              <div>{court.currentMatch.team1?.[0]?.name}/{court.currentMatch.team1?.[1]?.name} vs {court.currentMatch.team2?.[0]?.name}/{court.currentMatch.team2?.[1]?.name}</div>
                            )}
                          </div>
                        )}

                        <div className="flex flex-col gap-1">
                          {court.status === 'ready' && (
                            <Button
                              className="bg-brand-primary text-brand-white hover:bg-brand-primary/90 text-xs py-1"
                              onClick={() => assignMatchToCourt(court.courtNumber)}
                            >
                              Assign Match
                            </Button>
                          )}
                          {court.status === 'playing' && (
                            <>
                              <Button
                                className="bg-brand-secondary text-brand-primary hover:bg-brand-secondary/80 text-xs py-1"
                                onClick={() => {
                                  completeCourtMatch(court.courtNumber);
                                }}
                              >
                                Complete Match
                              </Button>
                              <Button
                                className="bg-gray-200 text-gray-700 hover:bg-gray-300 text-xs py-1"
                                onClick={() => {
                                  // Complete the match first (frees players and adds match to rounds for scoring)
                                  completeCourtMatch(court.courtNumber);
                                  // Then set court to cleaning (keeps it unavailable)
                                  updateCourtStatus(court.courtNumber, 'cleaning');
                                }}
                              >
                                Set Cleaning
                              </Button>
                            </>
                          )}
                          {court.status === 'cleaning' && (
                            <Button
                              className="bg-brand-secondary text-brand-primary hover:bg-brand-secondary/80 text-xs py-1"
                              onClick={() => updateCourtStatus(court.courtNumber, 'ready')}
                            >
                              Mark Ready
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {courtStates.every(c => c.status === 'ready') && rounds.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-brand-gray">
                      <Button
                        className="bg-brand-primary text-brand-white hover:bg-brand-primary/90 w-full"
                        onClick={() => {
                          setCurrentRound(prev => prev + 1);
                          alert(`Started Round ${currentRound + 2}. Assign matches to courts as they become ready.`);
                        }}
                      >
                        Start New Round (Round {currentRound + 2})
                      </Button>
                    </div>
                  )}
                </Card>

                {/* Next Up Queue */}
                <Card>
                  <h3 className="text-sm font-semibold text-brand-primary mb-3">Next Up (Not Currently Playing)</h3>
                  {getNextUpQueue.length === 0 ? (
                    <p className="text-sm text-brand-primary/70">All players/teams are currently on court</p>
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
                          {getNextUpQueue.slice(0, 10).map((item, idx) => (
                            <tr key={item.id} className="border-t border-brand-gray/60">
                              <td className="p-2 font-bold text-brand-primary">{idx + 1}</td>
                              <td className="p-2">
                                {gameFormat === 'teamed_doubles' ?
                                  `${item.player1.name} / ${item.player2.name}` :
                                  item.name
                                }
                              </td>
                              <td className="p-2">
                                {gameFormat === 'teamed_doubles' ?
                                  item.avgRating.toFixed(2) :
                                  item.rating
                                }
                              </td>
                              <td className="p-2">{item.roundsPlayed || 0}</td>
                              <td className="p-2">{item.roundsSatOut || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {getNextUpQueue.length > 10 && (
                        <div className="text-xs text-brand-primary/60 mt-2">
                          ...and {getNextUpQueue.length - 10} more
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </>
            )}

            {/* Round History */}
            <div className="border-t-2 border-brand-gray/40 pt-3">
              <h3 className="text-sm font-semibold text-brand-primary mb-3">Match History</h3>
              {rounds.length === 0 && (
                <Card className="text-center py-8 sm:py-10">
                  <div className="text-3xl sm:text-4xl mb-2">🗓️</div>
                  <div className="text-base sm:text-lg font-semibold text-brand-primary">No matches yet</div>
                  <p className="text-sm sm:text-base text-brand-primary/80 mt-1">
                    {tournamentType === 'round_robin' ?
                      'Assign matches to courts or use "Generate Next Round"' :
                      'Click "Generate Next Round" to start'
                    }
                  </p>
                </Card>
              )}
            </div>

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
                      <div className="absolute right-3 top-3 flex items-center gap-2 text-[11px] sm:text-xs text-brand-primary/60 flex-wrap justify-end">
                        <span>Diff {m.diff?.toFixed?.(2) ?? '--'}</span>
                        {m.teamGender && (
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            m.teamGender === 'male_male' ? 'bg-blue-100 text-blue-700' :
                            m.teamGender === 'female_female' ? 'bg-pink-100 text-pink-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {m.teamGender === 'male_male' ? 'M/M' :
                             m.teamGender === 'female_female' ? 'F/F' : 'Mixed'}
                          </span>
                        )}
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
                      )}

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


                        {m.status !== 'completed' ? (
                          <div className="flex flex-col gap-2">
                            <div className="grid grid-cols-2 gap-2 sm:flex">
                              <Button className="bg-brand-secondary text-brand-primary hover:bg-brand-secondary/80 w-full sm:w-auto" onClick={() => quickWin(rIdx, i, 1)}>
                                {m.gameFormat === 'singles' ? 'Player 1 wins' : 'Team 1 wins'}
                              </Button>
                              <Button className="bg-brand-secondary text-brand-primary hover:bg-brand-secondary/80 w-full sm:w-auto" onClick={() => quickWin(rIdx, i, 2)}>
                                {m.gameFormat === 'singles' ? 'Player 2 wins' : 'Team 2 wins'}
                              </Button>
                            </div>
                            {m.matchFormat === 'best_of_3' && (
                              <Button
                                className="bg-brand-primary text-brand-white hover:bg-brand-primary/90 text-sm"
                                onClick={() => {
                                  setRounds((prev) => {
                                    const newRounds = prev.map((r) => r.map((match) => ({ ...match })));
                                    const match = newRounds[rIdx][i];

                                    // Calculate winner from fresh state
                                    const winner = calculateBestOf3Winner(match);
                                    console.log('Setting winner to:', winner === 1 ? 'team1' : winner === 2 ? 'team2' : 'none');

                                    if (winner) {
                                      setWinner(match, winner);
                                      return newRounds;
                                    } else {
                                      alert('Please enter scores for at least 2 games to determine a winner.');
                                      return prev; // Don't update if no winner
                                    }
                                  });
                                }}
                              >
                                Submit Scores
                              </Button>
                            )}
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
              <Button className="bg-brand-gray text-brand-primary hover:bg-brand-gray/80 w-full" onClick={() => setEndOpen(false)}>
                Keep Editing
              </Button>
              <Button
                className="bg-brand-primary text-brand-white hover:bg-brand-primary/90 w-full"
                onClick={() => {
                  // If they haven't exported, warn them strongly
                  // If they have exported, still confirm but with a gentler message
                  const confirmMessage = !exportedThisSession
                    ? 'You have not exported your data! Clear all data anyway? This cannot be undone.'
                    : 'Clear all data? This cannot be undone.';

                  if (window.confirm(confirmMessage)) {
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
                    // Reset court states to initial ready state
                    const resetCourts = Array.from({ length: courts }, (_, i) => ({
                      courtNumber: i + 1,
                      status: 'ready',
                      currentMatch: null
                    }));
                    setCourtStates(resetCourts);
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