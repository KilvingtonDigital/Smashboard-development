const pool = require('../config/database');

class Player {
  // Create a new player with prioritized deduplication (Phone -> Email) and mandatory checks
  static async create({ user_id, player_name, dupr_rating, gender, email, phone, dupr_id, waiver_signed }) {
    if (!email || !phone) {
      throw new Error('Email and Phone are strictly mandatory fields to prevent duplicate registrations.');
    }

    const cleanPhone = phone.toString().replace(/\D/g, '');
    const cleanEmail = email.toString().trim().toLowerCase();
    const cleanName = player_name ? player_name.toString().trim() : '';

    let existingPlayer = null;

    // 1. Phone number lookup (Primary)
    const phoneRes = await pool.query(
      `SELECT * FROM players 
       WHERE user_id = $1 AND REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') = $2 
       LIMIT 1`,
      [user_id, cleanPhone]
    );
    if (phoneRes.rows.length > 0) {
      existingPlayer = phoneRes.rows[0];
    }

    // 2. Email lookup (Secondary)
    if (!existingPlayer) {
      const emailRes = await pool.query(
        'SELECT * FROM players WHERE user_id = $1 AND LOWER(email) = $2 LIMIT 1',
        [user_id, cleanEmail]
      );
      if (emailRes.rows.length > 0) {
        existingPlayer = emailRes.rows[0];
      }
    }

    if (existingPlayer) {
      // Update existing player with the fresh inputs
      const result = await pool.query(
        `UPDATE players
         SET player_name = COALESCE($1, player_name),
             dupr_rating = COALESCE($2, dupr_rating),
             gender = COALESCE($3, gender),
             email = COALESCE($4, email),
             phone = COALESCE($5, phone),
             dupr_id = COALESCE($6, dupr_id),
             waiver_signed = COALESCE($7, waiver_signed),
             waiver_timestamp = CASE WHEN $7 = TRUE AND waiver_signed = FALSE THEN NOW() ELSE waiver_timestamp END
         WHERE id = $8
         RETURNING *`,
        [
          cleanName || null,
          dupr_rating,
          gender,
          cleanEmail,
          phone,
          dupr_id,
          waiver_signed,
          existingPlayer.id
        ]
      );
      return result.rows[0];
    } else {
      // Create new player record, safe-guarded against name conflicts
      const result = await pool.query(
        `INSERT INTO players (user_id, player_name, dupr_rating, gender, email, phone, dupr_id, waiver_signed, waiver_timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $8 = TRUE THEN NOW() ELSE NULL END)
         ON CONFLICT (user_id, LOWER(player_name)) 
         DO UPDATE SET 
           dupr_rating = COALESCE(EXCLUDED.dupr_rating, players.dupr_rating),
           gender = COALESCE(EXCLUDED.gender, players.gender),
           email = COALESCE(EXCLUDED.email, players.email),
           phone = COALESCE(EXCLUDED.phone, players.phone),
           dupr_id = COALESCE(EXCLUDED.dupr_id, players.dupr_id),
           waiver_signed = COALESCE(EXCLUDED.waiver_signed, players.waiver_signed),
           waiver_timestamp = CASE WHEN EXCLUDED.waiver_signed = TRUE AND players.waiver_signed = FALSE THEN NOW() ELSE players.waiver_timestamp END
         RETURNING *`,
        [user_id, cleanName, dupr_rating, gender, cleanEmail, phone, dupr_id, waiver_signed]
      );
      return result.rows[0];
    }
  }

  // Get all players for a user (roster)
  static async findByUserId(user_id) {
    const result = await pool.query(
      'SELECT * FROM players WHERE user_id = $1 ORDER BY player_name ASC',
      [user_id]
    );
    return result.rows;
  }

  // Get player by ID
  static async findById(id, user_id) {
    const result = await pool.query(
      'SELECT * FROM players WHERE id = $1 AND user_id = $2',
      [id, user_id]
    );
    return result.rows[0];
  }

  // Update player
  static async update(id, user_id, updates) {
    const { player_name, dupr_rating, gender } = updates;

    const result = await pool.query(
      `UPDATE players
       SET player_name = COALESCE($1, player_name),
           dupr_rating = COALESCE($2, dupr_rating),
           gender = COALESCE($3, gender)
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [player_name, dupr_rating, gender, id, user_id]
    );
    return result.rows[0];
  }

  // Delete player
  static async delete(id, user_id) {
    const result = await pool.query(
      'DELETE FROM players WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, user_id]
    );
    return result.rows[0];
  }

  // Bulk create players with transaction-safe prioritized deduplication
  static async bulkCreate(user_id, players) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const createdPlayers = [];
      for (const player of players) {
        const { player_name, dupr_rating, gender, email, phone, dupr_id, waiver_signed } = player;

        if (!email || !phone) {
          throw new Error('Email and Phone are strictly mandatory fields for all bulk imports.');
        }

        const cleanPhone = phone.toString().replace(/\D/g, '');
        const cleanEmail = email.toString().trim().toLowerCase();
        const cleanName = player_name ? player_name.toString().trim() : '';

        let existingPlayer = null;

        // 1. Phone check
        const phoneRes = await client.query(
          `SELECT * FROM players 
           WHERE user_id = $1 AND REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') = $2 
           LIMIT 1`,
          [user_id, cleanPhone]
        );
        if (phoneRes.rows.length > 0) {
          existingPlayer = phoneRes.rows[0];
        }

        // 2. Email check
        if (!existingPlayer) {
          const emailRes = await client.query(
            'SELECT * FROM players WHERE user_id = $1 AND LOWER(email) = $2 LIMIT 1',
            [user_id, cleanEmail]
          );
          if (emailRes.rows.length > 0) {
            existingPlayer = emailRes.rows[0];
          }
        }

        if (existingPlayer) {
          const result = await client.query(
            `UPDATE players
             SET player_name = COALESCE($1, player_name),
                 dupr_rating = COALESCE($2, dupr_rating),
                 gender = COALESCE($3, gender),
                 email = COALESCE($4, email),
                 phone = COALESCE($5, phone),
                 dupr_id = COALESCE($6, dupr_id),
                 waiver_signed = COALESCE($7, waiver_signed),
                 waiver_timestamp = CASE WHEN $7 = TRUE AND waiver_signed = FALSE THEN NOW() ELSE waiver_timestamp END
             WHERE id = $8
             RETURNING *`,
            [
              cleanName || null,
              dupr_rating,
              gender,
              cleanEmail,
              phone,
              dupr_id,
              waiver_signed || false,
              existingPlayer.id
            ]
          );
          createdPlayers.push(result.rows[0]);
        } else {
          const result = await client.query(
            `INSERT INTO players (user_id, player_name, dupr_rating, gender, email, phone, dupr_id, waiver_signed, waiver_timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $8 = TRUE THEN NOW() ELSE NULL END)
             ON CONFLICT (user_id, LOWER(player_name)) 
             DO UPDATE SET 
               dupr_rating = COALESCE(EXCLUDED.dupr_rating, players.dupr_rating),
               gender = COALESCE(EXCLUDED.gender, players.gender),
               email = COALESCE(EXCLUDED.email, players.email),
               phone = COALESCE(EXCLUDED.phone, players.phone),
               dupr_id = COALESCE(EXCLUDED.dupr_id, players.dupr_id),
               waiver_signed = COALESCE(EXCLUDED.waiver_signed, players.waiver_signed),
               waiver_timestamp = CASE WHEN EXCLUDED.waiver_signed = TRUE AND players.waiver_signed = FALSE THEN NOW() ELSE players.waiver_timestamp END
             RETURNING *`,
            [user_id, cleanName, dupr_rating, gender, cleanEmail, phone, dupr_id, waiver_signed || false]
          );
          createdPlayers.push(result.rows[0]);
        }
      }

      await client.query('COMMIT');
      return createdPlayers;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Player;
