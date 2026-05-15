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
  { id: '8', name: 'Hannah Honeydew', rating: 4.2, gender: 'female' },
  { id: '9', name: 'Ian Ice', rating: 2.7, gender: 'male' },
  { id: '10', name: 'Julia Jackfruit', rating: 3.8, gender: 'female' },
  { id: '11', name: 'Kevin Kiwi', rating: 4.7, gender: 'male' },
  { id: '12', name: 'Laura Lemon', rating: 3.1, gender: 'female' },
  { id: '13', name: 'Mike Mango', rating: 2.9, gender: 'male' },
  { id: '14', name: 'Nina Nectarine', rating: 4.8, gender: 'female' },
  { id: '15', name: 'Oscar Orange', rating: 3.6, gender: 'male' },
  { id: '16', name: 'Penny Peach', rating: 2.8, gender: 'female' },
  { id: '17', name: 'Quinn Quince', rating: 4.1, gender: 'male' }
];

const courts = 4;
let schedulingStats = {};
presentPlayers.forEach(p => {
  schedulingStats[p.id] = { roundsPlayed: 0, roundsSatOut: 0, opponents: {} };
});

const simulatedRounds = [];

const originalConsoleLog = console.log;
console.log = () => {}; // Mute verbose logs from scheduler

for (let currentRound = 0; currentRound < 6; currentRound++) {
  const newRound = generateRoundRobinRound(
    presentPlayers, 
    courts, 
    schedulingStats, 
    currentRound, 
    false, 
    '1_game_to_11', 
    false, 
    2, 
    simulatedRounds
  );
  
  simulatedRounds.push(newRound);
}

console.log = originalConsoleLog;
console.log('\\n=== Final Play/Sit Stats Across 6 Rounds ===');

// Evaluate ground truth from simulatedRounds
const groundTruthSatOut = {};
const groundTruthPlayed = {};
presentPlayers.forEach(p => { 
  groundTruthSatOut[p.id] = 0; 
  groundTruthPlayed[p.id] = 0;
});

simulatedRounds.forEach(round => {
  const inRound = new Set();
  round.forEach(m => {
      m.team1?.forEach(p => inRound.add(p.id));
      m.team2?.forEach(p => inRound.add(p.id));
  });
  presentPlayers.forEach(p => {
      if (inRound.has(p.id)) groundTruthPlayed[p.id]++;
      else groundTruthSatOut[p.id]++;
  });
});

presentPlayers.forEach(p => {
  console.log(p.name.padEnd(20) + ' | Played: ' + groundTruthPlayed[p.id] + ' | Sat Out: ' + groundTruthSatOut[p.id]);
});
`;

fs.writeFileSync('scratch/run_sim.js', combinedCode + '\n' + runLogic);
