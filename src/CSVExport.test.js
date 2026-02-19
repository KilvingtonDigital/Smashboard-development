import { render } from '@testing-library/react';

// We need to test the toCSV function which is internal to PickleballTournamentManager.
// Since it's not exported, we might need to test it via the component or temporarily export it?
// Actually, for this specific logic, we can just copy the function logic here to verify the fix pattern 
// OR we can rely on the fact that toCSV is used when clicking "Download CSV".
// But clicking download involves FileSaver.js which is hard to mock in JSDOM.

// Better approach: Test the logic in isolation if possible, or simulate the "buildResults" -> "toCSV" flow.
// Start by creating a unit test that replicates the buggy function logic to demonstrate the failure/fix
// since we can't easily import the non-exported function.

const toCSV_Replica = (results) => {
    const header = [
        'round', 'court', 'court_level', 'game_format',
        't1_p1', 't1_p1_rating', 't1_p2', 't1_p2_rating',
        't2_p1', 't2_p1_rating', 't2_p2', 't2_p2_rating',
        't2_p1', 't2_p1_rating', 't2_p2', 't2_p2_rating',
        'match_format', 'score1', 'score2', 'games_won_t1', 'games_won_t2',
        'game1_t1', 'game1_t2', 'game2_t1', 'game2_t2', 'game3_t1', 'game3_t2',
        'winner', 'points_awarded', 'start_time', 'end_time', 'duration_minutes'
    ];
    const rows = results.matches.map((m) => {
        // ... (games won logic omitted for brevity as we test score1/score2) ...
        let gamesWonT1 = 0;
        let gamesWonT2 = 0;

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
            m.score1 || '', m.score2 || '', // <--- THE BUG IS HERE
            gamesWonT1, gamesWonT2,
            m.game1Score1 || '', m.game1Score2 || '',
            m.game2Score1 || '', m.game2Score2 || '',
            m.game3Score1 || '', m.game3Score2 || '',
            m.winner || '',
            m.pointsAwarded || '',
            m.startTime || '', m.endTime || '', m.durationMinutes || ''
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    return [header.join(','), ...rows].join('\n');
};

const toCSV_Fixed = (results) => {
    // Same as above but with fix
    const header = [
        'round', 'court', 'court_level', 'game_format',
        't1_p1', 't1_p1_rating', 't1_p2', 't1_p2_rating',
        't2_p1', 't2_p1_rating', 't2_p2', 't2_p2_rating',
        't2_p1', 't2_p1_rating', 't2_p2', 't2_p2_rating',
        'match_format', 'score1', 'score2', 'games_won_t1', 'games_won_t2',
        'game1_t1', 'game1_t2', 'game2_t1', 'game2_t2', 'game3_t1', 'game3_t2',
        'winner', 'points_awarded', 'start_time', 'end_time', 'duration_minutes'
    ];
    const rows = results.matches.map((m) => {
        let gamesWonT1 = 0;
        let gamesWonT2 = 0;

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
            // FIX: Use nullish coalescing
            m.score1 ?? '', m.score2 ?? '',
            gamesWonT1, gamesWonT2,
            m.game1Score1 ?? '', m.game1Score2 ?? '', // Also fix game scores
            m.game2Score1 ?? '', m.game2Score2 ?? '',
            m.game3Score1 ?? '', m.game3Score2 ?? '',
            m.winner || '',
            m.pointsAwarded || '',
            m.startTime || '', m.endTime || '', m.durationMinutes || ''
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    return [header.join(','), ...rows].join('\n');
};

describe('CSV Export Logic', () => {
    const mockResults = {
        matches: [
            {
                round: 1,
                court: 1,
                score1: 0,
                score2: 11,
                game1Score1: 0,
                game1Score2: 15,
                team1: [{ name: 'A', rating: 3.5 }],
                team2: [{ name: 'B', rating: 3.5 }]
            }
        ]
    };

    test('Replica (Current Code) fails to export 0 scores', () => {
        const csv = toCSV_Replica(mockResults);
        // Expect failure logic demonstration
        // "score1" is at index 17 (0-indexed) in the row array
        // The row string will look like: "1","1",...,"","11",...
        expect(csv).toContain(',"","11",'); // Matches empty score1 and 11 score2
    });

    test('Fixed logic successfully exports 0 scores', () => {
        const csv = toCSV_Fixed(mockResults);
        expect(csv).toContain(',"0","11",');
        expect(csv).toContain(',"0","15",'); // Game scores check
    });
});
