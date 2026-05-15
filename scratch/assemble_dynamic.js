const fs = require('fs');

let code1 = fs.readFileSync('src/schedulers/shared.js', 'utf8');
let code2 = fs.readFileSync('src/schedulers/doublesScheduler.js', 'utf8');

// Strip all exports and imports
let combinedCode = code1 + '\n\n' + code2;
combinedCode = combinedCode.replace(/export const /g, 'const ');
combinedCode = combinedCode.replace(/import .* from '.*';/g, '');

let runLogic = `
const presentPlayers = [
  { id: '1', name: 'Alice Apple', rating: 3.5, gender: 'female' },
  { id: '2', name: 'Bob Banana', rating: 4.0, gender: 'male' },
  { id: '3', name: 'Charlie Cherry', rating: 2.5, gender: 'male' },
  { id: '4', name: 'Diana Date', rating: 4.5, gender: 'female' },
  { id: '5', name: 'Evan Elderberry', rating: 3.0, gender: 'male' },
  { id: '6', name: 'Fiona Fig', rating: 5.0, gender: 'female' },
  { id: '7', name: 'George Grape', rating: 3.2, gender: 'male' },
  { id: '8', name: 'Hannah Honeydew', rating: 4.2, gender: 'female' }
];

const lateArrivals = [
  { id: '9', name: 'Ian Ice', rating: 2.7, gender: 'male' },
  { id: '10', name: 'Julia Jackfruit', rating: 3.8, gender: 'female' },
];

const courts = 4;
let schedulingStats = {};
presentPlayers.forEach(p => {
  schedulingStats[p.id] = { roundsPlayed: 0, roundsSatOut: 0, opponents: {} };
});
lateArrivals.forEach(p => {
  schedulingStats[p.id] = { roundsPlayed: 0, roundsSatOut: 0, opponents: {} };
});

const simulatedRounds = [];

const originalConsoleLog = console.log;
console.log = () => {}; // Mute verbose logs from scheduler


// Round 1-2 (8 players initially)
for (let currentRound = 0; currentRound < 2; currentRound++) {
  const newRound = generateRoundRobinRound(
    presentPlayers, courts, schedulingStats, currentRound, false, '1_game_to_11', false, 2, simulatedRounds
  );
  simulatedRounds.push(newRound);
}

// ROUND 3: Late Arrivals join
presentPlayers.push(...lateArrivals);

for (let currentRound = 2; currentRound < 4; currentRound++) {
    const newRound = generateRoundRobinRound(
      presentPlayers, courts, schedulingStats, currentRound, false, '1_game_to_11', false, 2, simulatedRounds
    );
    simulatedRounds.push(newRound);
}

// ROUND 5: Early Departure (Remove Alice Apple)
const indexZero = presentPlayers.findIndex(p => p.id === '1');
presentPlayers.splice(indexZero, 1); // remove player 1

for (let currentRound = 4; currentRound < 6; currentRound++) {
    const newRound = generateRoundRobinRound(
      presentPlayers, courts, schedulingStats, currentRound, false, '1_game_to_11', false, 2, simulatedRounds
    );
    simulatedRounds.push(newRound);
}

console.log = originalConsoleLog;
console.log('\\n=== Dynamic Roster Stats Across 6 Rounds ===');

const allTrackedPlayers = [...presentPlayers, ...lateArrivals, { id: '1', name: 'Alice Apple (Departed)' }];

const groundTruthSatOut = {};
const groundTruthPlayed = {};
allTrackedPlayers.forEach(p => { 
  groundTruthSatOut[p.id] = 0; 
  groundTruthPlayed[p.id] = 0;
});

simulatedRounds.forEach(round => {
  const inRound = new Set();
  round.forEach(m => {
      m.team1?.forEach(p => inRound.add(p.id));
      m.team2?.forEach(p => inRound.add(p.id));
  });
  
  // Only evaluate satout for players actually present during that round
  // For simplicity, we just aggregate who played.
  allTrackedPlayers.forEach(p => {
      if (inRound.has(p.id)) groundTruthPlayed[p.id]++;
  });
});

const unique = new Map();
allTrackedPlayers.forEach(p => unique.set(p.id, p));

Array.from(unique.values()).forEach(p => {
  console.log(p.name.padEnd(25) + ' | Played: ' + groundTruthPlayed[p.id]);
});
`;

fs.writeFileSync('scratch/run_dynamic.js', combinedCode + '\n' + runLogic);
