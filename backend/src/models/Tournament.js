const pool = require('../config/database');

class Tournament {
  // Create a new tournament
  static async create({ user_id, tournament_name, tournament_type, num_courts, tournament_data, event_date, registration_fee = 0.00 }) {
    const result = await pool.query(
      `INSERT INTO tournaments (user_id, tournament_name, tournament_type, num_courts, tournament_data, event_date, registration_fee)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [user_id, tournament_name, tournament_type, num_courts, JSON.stringify(tournament_data || { players: [] }), event_date, registration_fee]
    );
    return result.rows[0];
  }

  // Get all tournaments for a user
  static async findByUserId(user_id) {
    const result = await pool.query(
      `SELECT t.*, COUNT(tr.player_id)::integer as player_count
       FROM tournaments t
       LEFT JOIN tournament_registrations tr ON t.id = tr.tournament_id
       WHERE t.user_id = $1
       GROUP BY t.id
       ORDER BY t.event_date ASC NULLS LAST, t.created_at DESC`,
      [user_id]
    );
    return result.rows;
  }

  // Get tournament by ID
  static async findById(id, user_id) {
    const result = await pool.query(
      'SELECT * FROM tournaments WHERE id = $1 AND user_id = $2',
      [id, user_id]
    );
    return result.rows[0];
  }

  // Update tournament
  static async update(id, user_id, updates) {
    const { tournament_name, tournament_type, num_courts, tournament_data, event_date, registration_fee } = updates;

    const result = await pool.query(
      `UPDATE tournaments
       SET tournament_name = COALESCE($1, tournament_name),
           tournament_type = COALESCE($2, tournament_type),
           num_courts = COALESCE($3, num_courts),
           tournament_data = COALESCE($4, tournament_data),
           event_date = COALESCE($5, event_date),
           registration_fee = COALESCE($6, registration_fee),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [
        tournament_name,
        tournament_type,
        num_courts,
        tournament_data ? JSON.stringify(tournament_data) : null,
        event_date,
        registration_fee,
        id,
        user_id
      ]
    );
    return result.rows[0];
  }

  // Delete tournament
  static async delete(id, user_id) {
    const result = await pool.query(
      'DELETE FROM tournaments WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, user_id]
    );
    return result.rows[0];
  }
}

module.exports = Tournament;
