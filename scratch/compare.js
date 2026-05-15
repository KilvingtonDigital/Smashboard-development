const fs = require('fs');

function parseCSV(filepath) {
    const lines = fs.readFileSync(filepath, 'utf8').trim().split('\n');
    let hdr = lines[0].toLowerCase();
    // Some headers have different names manually typed
    hdr = hdr.replace('team1 player 1', 't1_p1');
    hdr = hdr.replace('team 1 player 2', 't1_p2');
    hdr = hdr.replace('team 2 player 1', 't2_p1');
    hdr = hdr.replace('team 2 player 2', 't2_p2');
    
    const headers = hdr.split(',').map(h => h.replace(/"/g, '').trim());
    return lines.slice(1).map(line => {
        const parts = line.split(',');
        const obj = {};
        headers.forEach((h, i) => {
            if (h && parts[i] !== undefined) obj[h] = parts[i].replace(/"/g, '').trim();
        });
        return obj;
    });
}

const appData = parseCSV('scratch/smashboard-round_robin-2026-04-18.csv');
const confData = parseCSV('scratch/Untitled spreadsheet.csv');

console.log('--- Differences found ---');
appData.forEach((appRow, i) => {
    const confRow = confData[i];
    if (!confRow) return;
    
    // Check points/winner
    if (appRow.score1 !== confRow.score1 || appRow.score2 !== confRow.score2 || appRow.winner !== confRow.winner) {
        console.log(`Round ${appRow.round} Court ${appRow.court} (Line ${i+2}):`);
        console.log(`  App : Score1=${appRow.score1} Score2=${appRow.score2} Winner=${appRow.winner}`);
        console.log(`  Conf: Score1=${confRow.score1} Score2=${confRow.score2} Winner=${confRow.winner}`);
    }

    // Check players
    const checkTeam = (p1_h, p2_h, teamNum) => {
        if (appRow[p1_h] !== confRow[p1_h] || appRow[p2_h] !== confRow[p2_h]) {
             console.log(`Round ${appRow.round} Court ${appRow.court} (Line ${i+2}):`);
             console.log(`  Players T${teamNum} App: ${appRow[p1_h]}, ${appRow[p2_h]}`);
             console.log(`  Players T${teamNum} Cnf: ${confRow[p1_h]}, ${confRow[p2_h]}`);
        }
    };
    checkTeam('t1_p1', 't1_p2', 1);
    checkTeam('t2_p1', 't2_p2', 2);
});
