/**
 * getSeedingOrder
 * Generates the professional tournament seeding placement order for a given bracket size.
 * e.g., for size 8: [1, 8, 4, 5, 2, 7, 3, 6]
 */
function getSeedingOrder(size) {
  let order = [1, 2];
  while (order.length < size) {
    const nextOrder = [];
    const target = order.length * 2 + 1;
    for (const seed of order) {
      nextOrder.push(seed);
      nextOrder.push(target - seed);
    }
    order = nextOrder;
  }
  return order;
}

/**
 * generateBracket
 * Generates winners and consolation bracket rounds and match nodes in a stateless way.
 */
export function generateBracket(players, teams, format = 'single_elim', gameFormat = 'doubles') {
  // 1. Normalize items based on gameFormat
  const items = gameFormat === 'singles'
    ? players.map((p, idx) => ({
        id: p.id,
        name: p.name || p.player_name,
        rating: parseFloat(p.rating || p.dupr_rating || 3.0),
        isPlayer: true
      }))
    : teams.map(t => ({
        id: t.id,
        name: t.name || `${t.player1.name} / ${t.player2.name}`,
        rating: parseFloat(t.avgRating || ((Number(t.player1.rating) + Number(t.player2.rating)) / 2)),
        isTeam: true,
        player1: t.player1,
        player2: t.player2
      }));

  // Sort items by rating descending (highest seed has highest DUPR rating)
  items.sort((a, b) => b.rating - a.rating);

  const numTeams = items.length;
  if (numTeams === 0) return { rounds: [], type: format };

  // Calculate bracket size as closest power of 2
  let bracketSize = 2;
  while (bracketSize < numTeams) {
    bracketSize *= 2;
  }

  const numRounds = Math.log2(bracketSize);
  const seedingOrder = getSeedingOrder(bracketSize);

  // Map items to seed positions
  const seededItems = [];
  for (let i = 0; i < bracketSize; i++) {
    const seedNum = seedingOrder[i];
    if (seedNum <= numTeams) {
      seededItems.push({
        ...items[seedNum - 1],
        seed: seedNum
      });
    } else {
      seededItems.push(null); // Bye
    }
  }

  // 2. Generate Winners Bracket Match Nodes
  const winnersMatchesByRound = {};
  for (let r = 1; r <= numRounds; r++) {
    const numMatches = bracketSize / Math.pow(2, r);
    winnersMatchesByRound[r] = [];
    for (let m = 0; m < numMatches; m++) {
      winnersMatchesByRound[r].push({
        id: `W-R${r}-M${m + 1}`,
        type: 'winners',
        round: r,
        matchIndex: m,
        team1: null,
        team2: null,
        score1: '',
        score2: '',
        winner: null,
        status: 'scheduled',
        nextMatchId: r < numRounds ? `W-R${r + 1}-M${Math.floor(m / 2) + 1}` : null,
        sourceMatch1Id: r > 1 ? `W-R${r - 1}-M${m * 2 + 1}` : null,
        sourceMatch2Id: r > 1 ? `W-R${r - 1}-M${m * 2 + 2}` : null
      });
    }
  }

  // Populate Winners Round 1
  const r1Winners = winnersMatchesByRound[1];
  for (let m = 0; m < r1Winners.length; m++) {
    const match = r1Winners[m];
    const team1 = seededItems[m * 2];
    const team2 = seededItems[m * 2 + 1];

    match.team1 = team1;
    match.team2 = team2;

    if (!team1 && !team2) {
      match.status = 'bye';
      match.winner = null;
    } else if (!team2) {
      match.status = 'bye';
      match.winner = 'team1';
    } else if (!team1) {
      match.status = 'bye';
      match.winner = 'team2';
    }
  }

  // Carry forward Round 1 byes
  for (let r = 1; r < numRounds; r++) {
    const currentMatches = winnersMatchesByRound[r];
    const nextMatches = winnersMatchesByRound[r + 1];
    for (const match of currentMatches) {
      if (match.status === 'bye' && match.winner) {
        const winningTeam = match.winner === 'team1' ? match.team1 : match.team2;
        const nextMatch = nextMatches.find(nm => nm.id === match.nextMatchId);
        if (nextMatch) {
          if (match.matchIndex % 2 === 0) {
            nextMatch.team1 = winningTeam;
          } else {
            nextMatch.team2 = winningTeam;
          }
        }
      }
    }
  }

  // 3. Generate Consolation Bracket Match Nodes (Double Elimination)
  const consolationMatchesByRound = {};
  if (format === 'double_elim' && numRounds >= 2) {
    // For Double Elimination, consolation has (numRounds - 1) * 2 rounds
    const totalConsolationRounds = (numRounds - 1) * 2;
    
    for (let r = 1; r <= totalConsolationRounds; r++) {
      // Round 1 has Winners R1 losers: size is bracketSize / 4
      // Round 2 size matches Round 1 size (Winners R2 losers join)
      // Round 3 has half size of Round 2
      // Round 4 size matches Round 3 size (Winners R3 losers join)
      // and so on...
      const wRoundAssoc = Math.floor((r + 2) / 2); // Winners round assoc (R2 for C-R1/C-R2, etc. actually let's calculate exact size)
      const divisionFactor = Math.pow(2, Math.floor((r + 1) / 2) + 1);
      const numMatches = bracketSize / divisionFactor;
      
      consolationMatchesByRound[r] = [];
      for (let m = 0; m < numMatches; m++) {
        const isLoserAdditionRound = r % 2 === 0;
        let nextId = null;
        if (r < totalConsolationRounds) {
          if (isLoserAdditionRound) {
            // Advancing from C-R2 to C-R3 (halves matches)
            nextId = `C-R${r + 1}-M${Math.floor(m / 2) + 1}`;
          } else {
            // Advancing from C-R1 to C-R2 (same number of matches)
            nextId = `C-R${r + 1}-M${m + 1}`;
          }
        } else {
          // Consolation Finals winner advances to Grand Finals (W-Finals is W-R[numRounds]-M1)
          // For Double Elimination, let's link Consolation Finals to Grand Finals
          nextId = `G-FINAL`;
        }

        consolationMatchesByRound[r].push({
          id: `C-R${r}-M${m + 1}`,
          type: 'consolation',
          round: r,
          matchIndex: m,
          team1: null,
          team2: null,
          score1: '',
          score2: '',
          winner: null,
          status: 'scheduled',
          nextMatchId: nextId
        });
      }
    }

    // Set up linkages between Winners Bracket and Consolation Bracket
    // Winners Round 1 Losers go to Consolation Round 1
    const wR1Matches = winnersMatchesByRound[1];
    const cR1Matches = consolationMatchesByRound[1];
    for (let m = 0; m < wR1Matches.length; m++) {
      const wMatch = wR1Matches[m];
      wMatch.loserMatchId = `C-R1-M${Math.floor(m / 2) + 1}`;
      wMatch.loserMatchPosition = m % 2 === 0 ? 'team1' : 'team2';
    }

    // Winners Round 2..K Losers go to Consolation Round 2, 4, 6.. (even rounds)
    for (let wr = 2; wr < numRounds; wr++) {
      const wMatches = winnersMatchesByRound[wr];
      const cr = (wr - 1) * 2; // Even consolation round
      const cMatches = consolationMatchesByRound[cr];
      if (cMatches) {
        for (let m = 0; m < wMatches.length; m++) {
          const wMatch = wMatches[m];
          wMatch.loserMatchId = `C-R${cr}-M${m + 1}`;
          wMatch.loserMatchPosition = 'team2'; // Loser joins on team2 position
        }
      }
    }

    // Winners Finals Loser goes to Consolation Finals (last even consolation round)
    const wFinalsMatch = winnersMatchesByRound[numRounds][0];
    const cFinalsRoundIdx = totalConsolationRounds;
    wFinalsMatch.loserMatchId = `C-R${cFinalsRoundIdx}-M1`;
    wFinalsMatch.loserMatchPosition = 'team2';
  }

  // Flatten winners matches into array
  const allWinnersMatches = [];
  for (let r = 1; r <= numRounds; r++) {
    allWinnersMatches.push(...winnersMatchesByRound[r]);
  }

  // Flatten consolation matches
  const allConsolationMatches = [];
  if (format === 'double_elim' && numRounds >= 2) {
    const totalConsolationRounds = (numRounds - 1) * 2;
    for (let r = 1; r <= totalConsolationRounds; r++) {
      allConsolationMatches.push(...consolationMatchesByRound[r]);
    }
  }

  // 4. Grand Finals Match (only for double elimination where Consolation Winner plays Winners Winner)
  const grandFinalsMatches = [];
  if (format === 'double_elim' && numRounds >= 2) {
    // Grand Finals Match 1
    grandFinalsMatches.push({
      id: `GF-M1`,
      type: 'grand_finals',
      round: 1,
      team1: null, // Winners Bracket Champion
      team2: null, // Consolation Bracket Champion
      score1: '',
      score2: '',
      winner: null,
      status: 'scheduled',
      nextMatchId: 'GF-M2' // advances to Match 2 if Consolation Champion wins (Double Elimination reset)
    });
    
    // Grand Finals Match 2 (If consolation winner wins match 1)
    grandFinalsMatches.push({
      id: `GF-M2`,
      type: 'grand_finals',
      round: 2,
      team1: null,
      team2: null,
      score1: '',
      score2: '',
      winner: null,
      status: 'scheduled',
      nextMatchId: null // Final Champion
    });
  }

  return {
    winnersMatches: allWinnersMatches,
    consolationMatches: allConsolationMatches,
    grandFinalsMatches: grandFinalsMatches,
    type: format,
    bracketSize,
    numRounds
  };
}

/**
 * advanceTournamentWinner
 * Modifies the bracket state by advancing a match winner to the next round,
 * and dropping the loser to the consolation bracket if double elimination.
 */
export function advanceTournamentWinner(bracket, matchId, winnerSide, matchScores) {
  const { winnersMatches = [], consolationMatches = [], grandFinalsMatches = [], type } = bracket;
  
  // Find match in winners, consolation, or grand finals
  let match = winnersMatches.find(m => m.id === matchId)
           || consolationMatches.find(m => m.id === matchId)
           || grandFinalsMatches.find(m => m.id === matchId);
           
  if (!match) return bracket;

  const winnerTeam = winnerSide === 1 ? match.team1 : match.team2;
  const loserTeam = winnerSide === 1 ? match.team2 : match.team1;

  match.winner = winnerSide === 1 ? 'team1' : 'team2';
  match.score1 = matchScores.score1;
  match.score2 = matchScores.score2;
  match.status = 'completed';

  // 1. ADVANCE WINNER
  if (match.nextMatchId) {
    if (match.nextMatchId === 'G-FINAL') {
      // Consolation Champion advances to Grand Finals Match 1
      const gf1 = grandFinalsMatches.find(m => m.id === 'GF-M1');
      if (gf1) gf1.team2 = winnerTeam;
    } else {
      // Normal advancement to next match
      let nextMatch = winnersMatches.find(m => m.id === match.nextMatchId)
                   || consolationMatches.find(m => m.id === match.nextMatchId)
                   || grandFinalsMatches.find(m => m.id === match.nextMatchId);
      
      if (nextMatch) {
        // If it's a Winners Match or Consolation Match, figure out where to place the winner
        if (nextMatch.type === 'winners') {
          if (match.matchIndex % 2 === 0) {
            nextMatch.team1 = winnerTeam;
          } else {
            nextMatch.team2 = winnerTeam;
          }
        } else if (nextMatch.type === 'consolation') {
          // For Consolation, even rounds have Winners losers on team2.
          // Odd consolation rounds or other rounds can place based on source.
          if (nextMatch.round % 2 === 0) {
            // Even consolation round: winner of previous consolation goes to team1
            nextMatch.team1 = winnerTeam;
          } else {
            // Odd consolation round: matches fold in half
            if (match.matchIndex % 2 === 0) {
              nextMatch.team1 = winnerTeam;
            } else {
              nextMatch.team2 = winnerTeam;
            }
          }
        }
      }
    }
  } else if (match.id === 'W-R' + Math.log2(bracket.bracketSize) + '-M1' && type === 'double_elim') {
    // Winners Bracket Champion advances to Grand Finals Match 1 as team1
    const gf1 = grandFinalsMatches.find(m => m.id === 'GF-M1');
    if (gf1) gf1.team1 = winnerTeam;
  }

  // 2. DROP LOSER (Double Elimination only)
  if (type === 'double_elim' && match.loserMatchId && loserTeam) {
    const loserMatch = consolationMatches.find(m => m.id === match.loserMatchId);
    if (loserMatch) {
      if (match.loserMatchPosition === 'team1') {
        loserMatch.team1 = loserTeam;
      } else {
        loserMatch.team2 = loserTeam;
      }
      
      // If the loser match team1 or team2 has a Bye or is already empty due to a Bye, 
      // handle auto-advancements in the losers bracket programmatically!
      if (!loserMatch.team1 && !loserMatch.team2) {
        loserMatch.status = 'bye';
      } else if (loserMatch.team1 && !loserMatch.team2 && loserMatch.round === 1) {
        // In consolation Round 1, if one team is a Bye, auto-advance the other!
        loserMatch.status = 'bye';
        loserMatch.winner = 'team1';
        // Recursively advance
        advanceTournamentWinner(bracket, loserMatch.id, 1, { score1: 0, score2: 0 });
      }
    }
  }

  // 3. SPECIAL GRAND FINALS LOGIC
  if (match.id === 'GF-M1') {
    // If Winners Champion (team1) wins GF-M1, they are the Grand Champion!
    if (winnerSide === 1) {
      match.nextMatchId = null; // No Match 2 needed!
      const gf2 = grandFinalsMatches.find(m => m.id === 'GF-M2');
      if (gf2) gf2.status = 'skipped';
    } else {
      // Consolation Champion (team2) won GF-M1: Double Elimination reset!
      // Match 2 is activated and plays
      const gf2 = grandFinalsMatches.find(m => m.id === 'GF-M2');
      if (gf2) {
        gf2.team1 = match.team1;
        gf2.team2 = match.team2;
        gf2.status = 'scheduled';
      }
    }
  }

  return bracket;
}
