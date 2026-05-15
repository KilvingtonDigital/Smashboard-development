const { generateRoundRobinRound } = require('../src/schedulers/doublesScheduler.js');

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

// Initialize stats
presentPlayers.forEach(p => {
  schedulingStats[p.id] = { roundsPlayed: 0, roundsSatOut: 0, opponents: {} };
});

const rounds = [];
const separateBySkill = false;
const effectiveMatchFormat = '1_game_to_11';
const preferMixedDoubles = false;
const femaleRestInterval = 0;

for (let currentRound = 1; currentRound <= 6; currentRound++) {
  const newRound = generateRoundRobinRound(
    presentPlayers, 
    courts, 
    schedulingStats, 
    currentRound, 
    separateBySkill, 
    effectiveMatchFormat, 
    preferMixedDoubles, 
    femaleRestInterval, 
    rounds
  );
  
  // Track who played in this round
  const playersInRound = new Set();
  newRound.forEach(match => {
    match.team1.forEach(p => playersInRound.add(p.id));
    match.team2.forEach(p => playersInRound.add(p.id));
  });
  
  // Find who sat out
  const satOut = presentPlayers.filter(p => !playersInRound.has(p.id));
  
  console.log(`\n=== Round ${currentRound} ===`);
  console.log(`Sat Out: ${satOut.map(p => p.name).join(', ')}`);
  
  // Update scheduling stats for next round
  presentPlayers.forEach(p => {
    if (playersInRound.has(p.id)) {
      schedulingStats[p.id].roundsPlayed += 1;
    } else {
      schedulingStats[p.id].roundsSatOut += 1;
    }
  });
  
  // Since we also need historically played matches for the internal history loop, 
  // we add the generated round to `rounds`
  rounds.push(newRound);
}

console.log('\n=== Final Play/Sit Stats ===');
presentPlayers.forEach(p => {
  console.log(`${p.name.padEnd(20)} | Played: ${schedulingStats[p.id].roundsPlayed} | Sat: ${schedulingStats[p.id].roundsSatOut}`);
});
