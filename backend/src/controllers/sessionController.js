const pool = require('../config/database');
const { sendSMS } = require('../config/sms');

/**
 * GET /api/session
 * Returns the active session blob for the logged-in user, or null.
 */
exports.getSession = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, tournament_data, tournament_name, tournament_type, num_courts, updated_at
       FROM tournaments
       WHERE user_id = $1 AND is_active_session = TRUE
       LIMIT 1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.json({ session: null });
        }

        const row = result.rows[0];
        res.json({
            session: {
                ...row.tournament_data,
                id: row.id,
                tournamentName: row.tournament_name,
                tournamentType: row.tournament_type,
                numCourts: row.num_courts,
                savedAt: row.updated_at
            }
        });
    } catch (error) {
        console.error('getSession error:', error);
        res.status(500).json({ error: 'Failed to load session' });
    }
};

/**
 * PUT /api/session
 * Upserts the active session for the logged-in user.
 * One active-session row per user — reuses the most-recent row rather than
 * creating duplicates, which was causing is_active_session to always end up FALSE.
 */
exports.saveSession = async (req, res) => {
    try {
        const { tournamentName = 'Active Session', tournamentType = 'roundRobin', numCourts = 1, ...sessionData } = req.body;

        // Find the most-recent session row for this user (active OR stale — we reuse it)
        const existing = await pool.query(
            `SELECT id, tournament_data FROM tournaments WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
            [req.user.id]
        );

        // Extract old court states for diffing
        let oldCourtStates = [];
        if (existing.rows.length > 0 && existing.rows[0].tournament_data) {
            oldCourtStates = existing.rows[0].tournament_data.courtStates || [];
        }

        // We run diffing and trigger SMS alerts asynchronously
        const newCourtStates = sessionData.courtStates || [];
        const playersRegistry = sessionData.players || [];

        newCourtStates.forEach((newCourt, newCourtIdx) => {
            if (newCourt.status === 'playing' && newCourt.currentMatch) {
                const newMatch = newCourt.currentMatch;
                const oldCourt = oldCourtStates.find(c => c.courtNumber === newCourt.courtNumber) || oldCourtStates[newCourtIdx];
                const oldMatch = oldCourt ? oldCourt.currentMatch : null;
                const oldStatus = oldCourt ? oldCourt.status : '';

                let isNewMatch = false;
                if (oldStatus !== 'playing' || !oldMatch) {
                    isNewMatch = true;
                } else {
                    const getMatchPlayersKey = (m) => {
                        const ids = [];
                        if (m.player1) ids.push(m.player1.id);
                        if (m.player2) ids.push(m.player2.id);
                        if (m.player3) ids.push(m.player3.id);
                        if (m.player4) ids.push(m.player4.id);
                        return `${m.startTime || ''}-${ids.sort().join('-')}`;
                    };
                    if (getMatchPlayersKey(oldMatch) !== getMatchPlayersKey(newMatch)) {
                        isNewMatch = true;
                    }
                }

                if (isNewMatch) {
                    // Send alerts for this new match
                    const activePlayers = [];
                    if (newMatch.player1) activePlayers.push({ key: 'p1', ref: newMatch.player1 });
                    if (newMatch.player2) activePlayers.push({ key: 'p2', ref: newMatch.player2 });
                    if (newMatch.player3) activePlayers.push({ key: 'p3', ref: newMatch.player3 });
                    if (newMatch.player4) activePlayers.push({ key: 'p4', ref: newMatch.player4 });

                    const resolvedPlayers = activePlayers.map(p => {
                        const fullProfile = playersRegistry.find(pr => pr.id === p.ref.id);
                        return {
                            id: p.ref.id,
                            name: fullProfile ? (fullProfile.player_name || fullProfile.name) : (p.ref.player_name || p.ref.name || 'Unknown'),
                            phone: fullProfile ? fullProfile.phone : null,
                            key: p.key
                        };
                    });

                    resolvedPlayers.forEach(p => {
                        if (!p.phone) {
                            console.warn(`[SMS SKIP] No phone number found for player ${p.name} (ID: ${p.id})`);
                            return;
                        }

                        let body = '';
                        const courtName = newCourt.courtNumber || newCourt.courtIndex + 1 || 'N/A';

                        if (newMatch.gameFormat === 'singles') {
                            const opponent = resolvedPlayers.find(o => o.id !== p.id);
                            const opponentName = opponent ? opponent.name : 'Unknown Opponent';
                            body = `DinkSync Alert: Your singles match on Court ${courtName} is now LIVE against ${opponentName}! Have a great game! 🏓`;
                        } else {
                            let partner = null;
                            let opponents = [];
                            if (p.key === 'p1') {
                                partner = resolvedPlayers.find(o => o.key === 'p3');
                                opponents = resolvedPlayers.filter(o => o.key === 'p2' || o.key === 'p4');
                            } else if (p.key === 'p3') {
                                partner = resolvedPlayers.find(o => o.key === 'p1');
                                opponents = resolvedPlayers.filter(o => o.key === 'p2' || o.key === 'p4');
                            } else if (p.key === 'p2') {
                                partner = resolvedPlayers.find(o => o.key === 'p4');
                                opponents = resolvedPlayers.filter(o => o.key === 'p1' || o.key === 'p3');
                            } else if (p.key === 'p4') {
                                partner = resolvedPlayers.find(o => o.key === 'p2');
                                opponents = resolvedPlayers.filter(o => o.key === 'p1' || o.key === 'p3');
                            }

                            const partnerName = partner ? partner.name : 'Unknown Partner';
                            const oppsNames = opponents.map(o => o.name).join(' & ');
                            body = `DinkSync Alert: Your doubles match on Court ${courtName} is now LIVE! Partner: ${partnerName}. Opponents: ${oppsNames}. Have a great game! 🏓`;
                        }

                        console.log(`[ALERT TRIGGER] Match started on Court ${courtName}! Sending SMS alert to ${p.name} (${p.phone})...`);
                        sendSMS({ to: p.phone, body }).catch(err => {
                            console.error(`[SMS ERROR] Failed to send to ${p.name}:`, err);
                        });
                    });
                }
            }
        });

        if (existing.rows.length > 0) {
            // Update the existing row and mark it as the active session
            await pool.query(
                `UPDATE tournaments
                 SET tournament_data    = $1,
                     tournament_name    = $2,
                     tournament_type    = $3,
                     num_courts         = $4,
                     is_active_session  = TRUE,
                     updated_at         = NOW()
                 WHERE id = $5`,
                [sessionData, tournamentName, tournamentType, numCourts, existing.rows[0].id]
            );
        } else {
            // First-ever save for this user — insert a new row
            await pool.query(
                `INSERT INTO tournaments (user_id, tournament_name, tournament_type, num_courts, tournament_data, is_active_session)
                 VALUES ($1, $2, $3, $4, $5, TRUE)`,
                [req.user.id, tournamentName, tournamentType, numCourts, sessionData]
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('saveSession error:', error);
        res.status(500).json({ error: 'Failed to save session' });
    }
};

/**
 * DELETE /api/session
 * Clears the active session flag — called on "End Session".
 */
exports.clearSession = async (req, res) => {
    try {
        await pool.query(
            `UPDATE tournaments SET is_active_session = FALSE WHERE user_id = $1 AND is_active_session = TRUE`,
            [req.user.id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('clearSession error:', error);
        res.status(500).json({ error: 'Failed to clear session' });
    }
};
