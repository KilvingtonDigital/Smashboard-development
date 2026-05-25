const pool = require('../config/database');

/**
 * GET /api/session
 * Returns the active session blob for the logged-in user, or null.
 */
exports.getSession = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT tournament_data, tournament_name, tournament_type, num_courts, updated_at, restricted_skill, restricted_age, restricted_gender, bracket_format
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
                tournamentName: row.tournament_name,
                tournamentType: row.tournament_type,
                numCourts: row.num_courts,
                restrictedSkill: row.restricted_skill || 'all',
                restrictedAge: row.restricted_age || 'all',
                restrictedGender: row.restricted_gender || 'all',
                bracketFormat: row.bracket_format || 'single_elim',
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
        const { 
            tournamentName = 'Active Session', 
            tournamentType = 'roundRobin', 
            numCourts = 1, 
            restrictedSkill = 'all', 
            restrictedAge = 'all', 
            restrictedGender = 'all', 
            bracketFormat = 'single_elim', 
            ...sessionData 
        } = req.body;

        // Find the most-recent session row for this user (active OR stale — we reuse it)
        const existing = await pool.query(
            `SELECT id FROM tournaments WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
            [req.user.id]
        );

        if (existing.rows.length > 0) {
            // Update the existing row and mark it as the active session
            await pool.query(
                `UPDATE tournaments
                 SET tournament_data    = $1,
                     tournament_name    = $2,
                     tournament_type    = $3,
                     num_courts         = $4,
                     restricted_skill   = $5,
                     restricted_age     = $6,
                     restricted_gender  = $7,
                     bracket_format     = $8,
                     is_active_session  = TRUE,
                     updated_at         = NOW()
                 WHERE id = $9`,
                [sessionData, tournamentName, tournamentType, numCourts, restrictedSkill, restrictedAge, restrictedGender, bracketFormat, existing.rows[0].id]
            );
        } else {
            // First-ever save for this user — insert a new row
            await pool.query(
                `INSERT INTO tournaments (user_id, tournament_name, tournament_type, num_courts, tournament_data, restricted_skill, restricted_age, restricted_gender, bracket_format, is_active_session)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)`,
                [req.user.id, tournamentName, tournamentType, numCourts, sessionData, restrictedSkill, restrictedAge, restrictedGender, bracketFormat]
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
