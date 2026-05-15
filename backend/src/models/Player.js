const pool = require('../config/database');

class Player {
  // Create a new player
  static async create({ user_id, player_name, dupr_rating, gender }) {
    const result = await pool.query(
      `INSERT INTO players (user_id, player_name, dupr_rating, gender)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, LOWER(player_name)) 
       DO UPDATE SET 
         dupr_rating = COALESCE(EXCLUDED.dupr_rating, players.dupr_rating), 
         gender = COALESCE(EXCLUDED.gender, players.gender)
       RETURNING *`,
      [user_id, player_name, dupr_rating, gender]
    );
    return result.rows[0];
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

  // Bulk create players
  static async bulkCreate(user_id, players) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const createdPlayers = [];
      for (const player of players) {
        const result = await client.query(
          `INSERT INTO players (user_id, player_name, dupr_rating, gender)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, LOWER(player_name)) 
           DO UPDATE SET 
             dupr_rating = COALESCE(EXCLUDED.dupr_rating, players.dupr_rating), 
             gender = COALESCE(EXCLUDED.gender, players.gender)
           RETURNING *`,
          [user_id, player.player_name, player.dupr_rating, player.gender]
        );
        createdPlayers.push(result.rows[0]);
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
