const fs = require('fs');

function parseCSV(filepath) {
    const lines = fs.readFileSync(filepath, 'utf8').trim().split('\n');
    let hdr = lines[0].toLowerCase();
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

const countMatches = (data) => {
    const counts = {};
    data.forEach(r => {
        [r.t1_p1, r.t1_p2, r.t2_p1, r.t2_p2].forEach(p => {
             if (!p) return;
             counts[p] = (counts[p] || 0) + 1;
        });
    });
    return counts;
};

const appCounts = countMatches(appData);
const confCounts = countMatches(confData);

console.log('--- Played Game Counts ---');
const players = Array.from(new Set([...Object.keys(appCounts), ...Object.keys(confCounts)])).sort();
players.forEach(p => {
    const a = appCounts[p] || 0;
    const c = confCounts[p] || 0;
    console.log(`${p.padEnd(25)} | App Generated: ${a} | Confirmed Played: ${c}`);
});
