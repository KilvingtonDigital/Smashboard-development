/**
 * doublesScheduler.js
 * Fully self-contained scheduler for Round Robin Doubles.
 * ISOLATION RULE: Only imports from shared.js. Never imports from other schedulers.
 * To apply a bug fix from here to another format, that must be a deliberate separate change.
 *
 * NOTE: opponents and teammates are stored as plain objects { [id]: count }, NOT Maps.
 * This is intentional — Maps silently become {} when passed through JSON.stringify/parse
 * (localStorage / cloud session restore), causing .get() to crash on the next round.
 */

const { uid, avg, SKILL_LEVELS, getPlayerSkillLevel, canPlayTogether, separatePlayersBySkill } = require('./shared.js');;

/* ── Internal: initialise a fresh stat entry per player ── */
const initializePlayerStats = (playerStats, presentPlayers) => {
    const updatedStats = { ...playerStats };
    presentPlayers.forEach(p => {
        if (!updatedStats[p.id]) {
            console.log(`NEW PLAYER ADDED: ${p.name} (${p.rating})`);
            updatedStats[p.id] = {
                player: p,
                roundsPlayed: 0,
                roundsSatOut: 0,
                consecutiveRounds: 0,
                lastPlayedRound: -1,
                teammates: {},   // plain object — survives JSON round-trips
                opponents: {},   // plain object — survives JSON round-trips
            };
        } else {
            updatedStats[p.id].player = p;
            if (updatedStats[p.id].consecutiveRounds === undefined) updatedStats[p.id].consecutiveRounds = 0;
            // Defensive: coerce any legacy Maps that might have snuck in via old saved state
            if (!updatedStats[p.id].teammates || updatedStats[p.id].teammates instanceof Map) updatedStats[p.id].teammates = {};
            if (!updatedStats[p.id].opponents || updatedStats[p.id].opponents instanceof Map) updatedStats[p.id].opponents = {};
        }
    });
    return updatedStats;
};

/* ── Internal: validate fairness (warning only) ── */
const validateFairness = (playerStats, presentPlayers, currentRound) => {
    if (currentRound === 0) return true;

    const playStats = presentPlayers.map(p => {
        const stats = playerStats[p.id] || { roundsPlayed: 0, roundsSatOut: 0 };
        return { name: p.name, rating: p.rating, played: stats.roundsPlayed, satOut: stats.roundsSatOut };
    });

    const notPlayed = playStats.filter(s => s.played === 0);
    if (notPlayed.length > 0 && currentRound >= 2) {
        console.error(`🚨 CRITICAL FAIRNESS ISSUE: ${notPlayed.length} player(s) have NOT played ANY games after ${currentRound + 1} rounds!`);
        notPlayed.forEach(p => console.error(`   ❌ ${p.name} (${p.rating}) - 0 games played, ${p.satOut} sat out`));
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

/* ── Internal: select players for the round (gender-aware, consecutive rest) ── */
const selectPlayersForRound = (allPlayers, playerStats, maxPlayers, roundIdx, preferMixedDoubles = false, femaleRestInterval = 2) => {
    if (allPlayers.length <= maxPlayers) return [...allPlayers];

    if (preferMixedDoubles) {
        const women = allPlayers.filter(p => p.gender === 'female');
        const men = allPlayers.filter(p => p.gender !== 'female');
        const maxCourts = maxPlayers / 4;

        const scoredWomen = women.map(p => {
            const stats = playerStats[p.id] || { roundsPlayed: 0, roundsSatOut: 0, consecutiveRounds: 0, lastPlayedRound: -1 };
            let priority = stats.roundsSatOut * 500;
            if (stats.lastPlayedRound >= 0) priority += (roundIdx - stats.lastPlayedRound) * 200;
            else priority += 1000;
            priority += Math.random() * 1;
            const consecutive = stats.consecutiveRounds || 0;
            if (consecutive >= femaleRestInterval) {
                priority -= 2000;
                console.log(`[Rest] ${p.name} consecutive=${consecutive} >= restInterval=${femaleRestInterval} — soft rest applied`);
            }
            return { player: p, priority };
        });
        scoredWomen.sort((a, b) => b.priority - a.priority);

        const maxWomenSlots = Math.min(women.length, maxCourts * 2);
        const selectedWomen = scoredWomen.slice(0, maxWomenSlots).map(sw => sw.player);

        const scoredMen = men.map(p => {
            const stats = playerStats[p.id] || { roundsPlayed: 0, roundsSatOut: 0, lastPlayedRound: -1 };
            let priority = stats.roundsSatOut * 500;
            if (stats.lastPlayedRound >= 0) priority += (roundIdx - stats.lastPlayedRound) * 200;
            else priority += 1000;
            const avgRoundsPlayed = roundIdx > 0
                ? Object.values(playerStats).reduce((sum, s) => sum + (s.roundsPlayed || 0), 0) / Object.keys(playerStats).length
                : 0;
            priority += (avgRoundsPlayed - stats.roundsPlayed) * 100;
            priority += Math.random() * 1;
            return { player: p, priority };
        });
        scoredMen.sort((a, b) => b.priority - a.priority);

        const remainingSlots = maxPlayers - selectedWomen.length;
        const selectedMen = scoredMen.slice(0, remainingSlots).map(sm => sm.player);

        const result = [...selectedWomen, ...selectedMen];
        if (result.length < maxPlayers) {
            const usedIds = new Set(result.map(p => p.id));
            const extras = allPlayers.filter(p => !usedIds.has(p.id)).slice(0, maxPlayers - result.length);
            result.push(...extras);
        }

        console.log(`[Gender-Aware] Selected ${selectedWomen.length}W + ${selectedMen.length}M for ${maxPlayers} spots`);
        return result.slice(0, maxPlayers);
    }

    // Standard selection
    const playerPriority = allPlayers.map(p => {
        const stats = playerStats[p.id] || { roundsPlayed: 0, roundsSatOut: 0, lastPlayedRound: -1 };
        let priority = stats.roundsSatOut * 500;
        if (stats.lastPlayedRound >= 0) priority += (roundIdx - stats.lastPlayedRound) * 200;
        else priority += 1000;
        const avgRoundsPlayed = roundIdx > 0
            ? Object.values(playerStats).reduce((sum, s) => sum + (s.roundsPlayed || 0), 0) / Object.keys(playerStats).length
            : 0;
        priority += (avgRoundsPlayed - stats.roundsPlayed) * 100;
        priority += Math.random() * 1;
        return { player: p, priority, stats };
    });

    const sorted = playerPriority.sort((a, b) => b.priority - a.priority);
    const selected = sorted.slice(0, maxPlayers);
    const sittingOut = sorted.slice(maxPlayers);

    console.log(`[selectPlayers] Selecting ${maxPlayers} of ${allPlayers.length} players (round ${roundIdx}):`);
    selected.forEach(({ player, priority, stats }) =>
        console.log(`  ✅ PLAYING  ${player.name.padEnd(20)} priority=${priority.toFixed(1)} satOut=${stats.roundsSatOut} played=${stats.roundsPlayed} lastRound=${stats.lastPlayedRound}`)
    );
    sittingOut.forEach(({ player, priority, stats }) =>
        console.log(`  💤 SITTING  ${player.name.padEnd(20)} priority=${priority.toFixed(1)} satOut=${stats.roundsSatOut} played=${stats.roundsPlayed} lastRound=${stats.lastPlayedRound}`)
    );

    return selected.map(item => item.player);
};

/* ── Internal: find the best rating-balanced team split for a group of 4 ── */
const findBestTeamSplit = (group, playerStats, preferMixedDoubles = false) => {
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
        score += Math.abs(avg(split.team1) - avg(split.team2)) * 100;

        const stats1 = playerStats[split.team1[0].id] || { teammates: {} };
        const stats2 = playerStats[split.team2[0].id] || { teammates: {} };
        const team1History = (stats1.teammates || {})[split.team1[1].id] || 0;
        const team2History = (stats2.teammates || {})[split.team2[1].id] || 0;
        score += (team1History + team2History) * 15;

        const level1 = getPlayerSkillLevel(split.team1[0].rating);
        const level2 = getPlayerSkillLevel(split.team1[1].rating);
        const level3 = getPlayerSkillLevel(split.team2[0].rating);
        const level4 = getPlayerSkillLevel(split.team2[1].rating);
        if (level1.key === level2.key) score -= 3;
        if (level3.key === level4.key) score -= 3;

        if (preferMixedDoubles) {
            const team1IsMixed = split.team1.some(p => p.gender === 'female') && split.team1.some(p => p.gender !== 'female');
            const team2IsMixed = split.team2.some(p => p.gender === 'female') && split.team2.some(p => p.gender !== 'female');
            if (team1IsMixed) score -= 40;
            if (team2IsMixed) score -= 40;
        }

        if (score < bestScore) { bestScore = score; bestSplit = split; }
    });

    return bestSplit;
};

/* ── Internal: evaluate group quality (lower = better) ── */
const evaluateGroupQuality = (group, playerStats) => {
    let penalty = 0;
    const ratings = group.map(p => p.rating).sort((a, b) => b - a);
    penalty += (ratings[0] - ratings[ratings.length - 1]) * 2;

    for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
            const stats = playerStats[group[i].id] || { teammates: {} };
            penalty += ((stats.teammates || {})[group[j].id] || 0) * 10;
        }
    }

    const skillLevels = group.map(p => getPlayerSkillLevel(p.rating).key);
    const uniqueSkillLevels = new Set(skillLevels).size;
    if (uniqueSkillLevels > 1) {
        const levelIndices = skillLevels.map(level => Object.keys(SKILL_LEVELS).indexOf(level));
        const minIndex = Math.min(...levelIndices);
        const maxIndex = Math.max(...levelIndices);
        penalty += maxIndex - minIndex > 1 ? 25 : 5;
    }

    return penalty;
};

/* ── Internal: select the best group of 4 from available players ── */
const selectBestGroupOfFour = (availablePlayers, playerStats) => {
    if (availablePlayers.length <= 4) return availablePlayers;

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
                        const stats = playerStats[existing.id] || { teammates: {} };
                        varietyScore += Math.max(0, 5 - ((stats.teammates || {})[candidate.id] || 0));
                    });
                    if (group.every(existing => canPlayTogether(existing, candidate))) varietyScore += 2;
                    varietyScore += Math.random() * 2;
                    return { player: candidate, score: varietyScore };
                });
                scores.sort((a, b) => b.score - a.score);
                const topCandidates = Math.min(3, scores.length);
                const chosen = scores[Math.floor(Math.random() * topCandidates)].player;
                group.push(chosen);
                candidates.splice(candidates.indexOf(chosen), 1);
            }
        }

        if (group.length === 4) {
            const groupScore = evaluateGroupQuality(group, playerStats);
            if (groupScore < bestScore) { bestScore = groupScore; bestGroup = [...group]; }
        }
    }

    return bestGroup || availablePlayers.slice(0, 4);
};

/* ── Internal: create balanced doubles matches from a selected player pool ── */
const createBalancedMatches = (playersThisRound, playerStats, maxCourts, startingCourtIndex, roundIdx, groupType, matchFormat, preferMixedDoubles = false) => {
    const matches = [];
    const usedPlayers = new Set();
    const availablePlayers = [...playersThisRound];
    const actualCourts = Math.min(maxCourts, Math.floor(availablePlayers.length / 4));

    for (let courtIdx = 0; courtIdx < actualCourts; courtIdx++) {
        const remaining = availablePlayers.filter(p => !usedPlayers.has(p.id));
        if (remaining.length < 4) break;

        const group = selectBestGroupOfFour(remaining, playerStats);
        if (!group || group.length < 4) break;

        const teamSplit = findBestTeamSplit(group, playerStats, preferMixedDoubles);
        group.forEach(p => usedPlayers.add(p.id));

        matches.push({
            id: uid(),
            court: startingCourtIndex + courtIdx,
            team1: teamSplit.team1,
            team2: teamSplit.team2,
            diff: Math.abs(avg(teamSplit.team1) - avg(teamSplit.team2)),
            score1: '', score2: '',
            game1Score1: '', game1Score2: '',
            game2Score1: '', game2Score2: '',
            game3Score1: '', game3Score2: '',
            status: 'pending',
            winner: null,
            skillLevel: groupType,
            gameFormat: 'doubles',
            matchFormat,
        });
    }

    return matches;
};

/* ── Internal: generate matches for a skill group ── */
const generateMatchesForGroup = (groupPlayers, playerStats, maxCourts, startingCourtIndex, roundIndex, groupType, matchFormat, preferMixedDoubles = false, femaleRestInterval = 2) => {
    console.log(`Generating ${groupType} matches for ${groupPlayers.length} players`);

    const maxPlayersPerRound = maxCourts * 4;
    const playersThisRound = selectPlayersForRound(groupPlayers, playerStats, maxPlayersPerRound, roundIndex, preferMixedDoubles, femaleRestInterval);

    console.log(`${groupType} - Playing: ${playersThisRound.map(p => `${p.name}(${p.rating})`).join(', ')}`);
    console.log(`${groupType} - Sitting out: ${groupPlayers.filter(p => !playersThisRound.includes(p)).map(p => `${p.name}(${p.rating})`).join(', ')}`);

    return createBalancedMatches(playersThisRound, playerStats, maxCourts, startingCourtIndex, roundIndex, groupType, matchFormat, preferMixedDoubles);
};

/* ── Internal: update player stats after the round ── */
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
            stats.consecutiveRounds = (stats.consecutiveRounds || 0) + 1;
        } else {
            stats.roundsSatOut++;
            stats.consecutiveRounds = 0;
        }
    });

    matches.forEach(match => {
        const { team1, team2 } = match;
        if (team1?.length === 2) {
            const [p1, p2] = team1;
            if (!playerStats[p1.id].teammates) playerStats[p1.id].teammates = {};
            if (!playerStats[p2.id].teammates) playerStats[p2.id].teammates = {};
            playerStats[p1.id].teammates[p2.id] = (playerStats[p1.id].teammates[p2.id] || 0) + 1;
            playerStats[p2.id].teammates[p1.id] = (playerStats[p2.id].teammates[p1.id] || 0) + 1;
        }
        if (team2?.length === 2) {
            const [p1, p2] = team2;
            if (!playerStats[p1.id].teammates) playerStats[p1.id].teammates = {};
            if (!playerStats[p2.id].teammates) playerStats[p2.id].teammates = {};
            playerStats[p1.id].teammates[p2.id] = (playerStats[p1.id].teammates[p2.id] || 0) + 1;
            playerStats[p2.id].teammates[p1.id] = (playerStats[p2.id].teammates[p1.id] || 0) + 1;
        }
        team1?.forEach(p1 => {
            team2?.forEach(p2 => {
                if (!playerStats[p1.id].opponents) playerStats[p1.id].opponents = {};
                if (!playerStats[p2.id].opponents) playerStats[p2.id].opponents = {};
                playerStats[p1.id].opponents[p2.id] = (playerStats[p1.id].opponents[p2.id] || 0) + 1;
                playerStats[p2.id].opponents[p1.id] = (playerStats[p2.id].opponents[p1.id] || 0) + 1;
            });
        });
    });
};

/* ══════════════════════════════════════════════════════════
   PUBLIC API
   ══════════════════════════════════════════════════════════ */

/**
 * generateRoundRobinRound
 * Separates players by skill (optional), selects fairly, pairs by rating,
 * applies a global fairness sweep to rescue consecutive sit-outs, and returns matches.
 */
const generateRoundRobinRound = (
    presentPlayers, courts, playerStats, currentRoundIndex,
    separateBySkill = true, matchFormat = 'single_match',
    preferMixedDoubles = false, femaleRestInterval = 2, previousRounds = []
) => {
    console.log(`\n=== [DOUBLES SCHEDULER] GENERATING ROUND ${currentRoundIndex + 1} ===`);
    console.log(`Present players: ${presentPlayers.length}, preferMixed: ${preferMixedDoubles}, femaleRestInterval: ${femaleRestInterval}`);

    if (typeof matchFormat === 'undefined') {
        throw new Error('Match format is not defined. Please select a valid match format in Setup.');
    }

    const updatedStats = initializePlayerStats(playerStats, presentPlayers);
    let matches = [];

    if (separateBySkill && presentPlayers.length >= 8) {
        const { groups: skillGroups, bumpedPlayers } = separatePlayersBySkill(presentPlayers, 4);
        if (bumpedPlayers.length > 0) console.log(`Players bumped: ${bumpedPlayers.map(p => p.name).join(', ')}`);

        let courtIndex = 1;
        const courtsPerGroup = Math.floor(courts / Math.max(1, skillGroups.length));
        let extraCourts = courts % Math.max(1, skillGroups.length);

        skillGroups.forEach(skillGroup => {
            if (skillGroup.players.length >= 4) {
                const groupCourts = courtsPerGroup + (extraCourts > 0 ? 1 : 0);
                if (extraCourts > 0) extraCourts--;
                const groupMatches = generateMatchesForGroup(skillGroup.players, updatedStats, groupCourts, courtIndex, currentRoundIndex, skillGroup.label, matchFormat, preferMixedDoubles, femaleRestInterval);
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
                const extraMatches = createBalancedMatches(remainingPlayers, updatedStats, remainingCourts, courtIndex, currentRoundIndex, 'Mixed (Overflow)', matchFormat, preferMixedDoubles, femaleRestInterval);
                matches.push(...extraMatches);
                console.log(`Added ${extraMatches.length} overflow match(es)`);
            }
        }
    } else {
        matches = generateMatchesForGroup(presentPlayers, updatedStats, courts, 1, currentRoundIndex, 'Mixed', matchFormat, preferMixedDoubles, femaleRestInterval);
    }

    // ── GLOBAL FAIRNESS SWEEP ────────────────────────────────────────────────
    // Runs after BOTH branches. Uses ground-truth sit-out counts from previousRounds.
    if (previousRounds.length > 0) {
        const fsPlayingIds = new Set();
        matches.forEach(match => {
            if (match.team1) match.team1.forEach(p => fsPlayingIds.add(p.id));
            if (match.team2) match.team2.forEach(p => fsPlayingIds.add(p.id));
        });
        const fsSittingOut = presentPlayers.filter(p => !fsPlayingIds.has(p.id));
        if (fsSittingOut.length > 0) {
            const groundTruthSatOut = {};
            presentPlayers.forEach(p => { groundTruthSatOut[p.id] = 0; });
            previousRounds.forEach(round => {
                if (round.length === 0) return;
                const inRound = new Set();
                round.forEach(m => {
                    m.team1?.forEach(p => inRound.add(p.id));
                    m.team2?.forEach(p => inRound.add(p.id));
                });
                presentPlayers.forEach(p => {
                    if (!inRound.has(p.id)) groundTruthSatOut[p.id] = (groundTruthSatOut[p.id] || 0) + 1;
                });
            });

            const totalSatOut = presentPlayers.reduce((sum, p) => sum + (groundTruthSatOut[p.id] || 0), 0);
            const avgSatOut = totalSatOut / presentPlayers.length;

            const fairnessCandidates = fsSittingOut
                .map(p => ({ player: p, satOut: groundTruthSatOut[p.id] || 0 }))
                .filter(({ satOut }) => satOut > avgSatOut)
                .sort((a, b) => b.satOut - a.satOut);

            console.log(`[Fairness] avg=${avgSatOut.toFixed(2)} candidates=${fairnessCandidates.map(c => `${c.player.name}(${c.satOut})`).join(', ')}`);

            fairnessCandidates.forEach(({ player: needsIn }) => {
                const needsInSatOut = groundTruthSatOut[needsIn.id] || 0;
                let swapCandidate = null;
                let bestSwapScore = Infinity;

                matches.forEach(match => {
                    [...(match.team1 || []), ...(match.team2 || [])].forEach(p => {
                        const pSatOut = groundTruthSatOut[p.id] || 0;
                        if (pSatOut >= needsInSatOut) return;
                        const ratingDiff = Math.abs(Number(p.rating) - Number(needsIn.rating));
                        if (ratingDiff > 0.5) return;
                        const swapScore = ratingDiff * 10 + pSatOut;
                        if (swapScore < bestSwapScore) { bestSwapScore = swapScore; swapCandidate = { player: p, match }; }
                    });
                });

                if (swapCandidate) {
                    const m = swapCandidate.match;
                    console.log(`[Fairness Swap] ${needsIn.name}(${needsIn.rating}) in for ${swapCandidate.player.name}(${swapCandidate.player.rating})`);
                    const allFour = [...(m.team1 || []), ...(m.team2 || [])].map(p => p.id === swapCandidate.player.id ? needsIn : p);
                    const rebalanced = findBestTeamSplit(allFour, updatedStats, preferMixedDoubles);
                    m.team1 = rebalanced.team1; m.team2 = rebalanced.team2;
                    m.diff = Math.abs(avg(rebalanced.team1) - avg(rebalanced.team2));
                    fsPlayingIds.delete(swapCandidate.player.id); fsPlayingIds.add(needsIn.id);
                }
            });
        }
    }
    // ── END GLOBAL FAIRNESS SWEEP ────────────────────────────────────────────

    updatePlayerStatsForRound(updatedStats, presentPlayers, matches, currentRoundIndex);
    validateFairness(updatedStats, presentPlayers, currentRoundIndex);
    Object.assign(playerStats, updatedStats);

    console.log(`\n=== [DOUBLES SCHEDULER] ROUND ${currentRoundIndex + 1} SUMMARY ===`);
    console.log(`Courts requested: ${courts}, Courts used: ${matches.length}`);
    console.log(`Players present: ${presentPlayers.length}, Players playing: ${matches.reduce((sum) => sum + 4, 0)}`);
    console.log(`Players sitting: ${presentPlayers.length - matches.reduce((sum) => sum + 4, 0)}`);

    if (matches.length < courts) console.warn(`⚠️ WARNING: Only using ${matches.length} of ${courts} courts!`);

    return matches;
};


module.exports = { generateRoundRobinRound, selectBestGroupOfFour, findBestTeamSplit };