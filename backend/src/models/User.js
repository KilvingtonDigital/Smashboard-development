const pool = require('../config/database');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

class User {
  // Create a new user
  static async create({ firstName, lastName, email, password }) {
    try {
      // Hash password
      const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

      // Generate a unique username based on name to satisfy DB constraint
      // Pattern: firstname_lastname_randomString
      const baseHandle = `${firstName.toLowerCase().replace(/\s/g, '')}_${lastName.toLowerCase().replace(/\s/g, '')}`;
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      const username = `${baseHandle}_${randomSuffix}`;

      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, first_name, last_name)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, email, first_name, last_name, created_at`,
        [username, email, password_hash, firstName, lastName]
      );

      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        if (error.constraint === 'users_email_key') {
          throw new Error('Email already exists');
        }
        if (error.constraint === 'users_username_key') {
          // This should handle rare collision of generated username by retrying? 
          // For simplicity, we just throw, but in production we'd loop.
          throw new Error('Username generation collision, please try again');
        }
      }
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  // Find user by username
  static async findByUsername(username) {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0];
  }

  // Find user by ID
  static async findById(id) {
    const result = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  // Verify password
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Update user
  static async update(id, updates) {
    const { username, email } = updates;
    const result = await pool.query(
      `UPDATE users
       SET username = COALESCE($1, username),
           email = COALESCE($2, email),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, username, email, updated_at`,
      [username, email, id]
    );
    return result.rows[0];
  }

  // Delete user
  static async delete(id) {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
  }

  // Save reset token (hash it first if you prefer, usually tokens are hashed)
  static async saveResetToken(userId, tokenHash, expiryDate) {
    await pool.query(
      `UPDATE users
       SET reset_token_hash = $1,
           reset_token_expiry = $2
       WHERE id = $3`,
      [tokenHash, expiryDate, userId]
    );
  }

  // Find user by reset token (valid only)
  static async findByResetToken(tokenHash) {
    const result = await pool.query(
      `SELECT * FROM users
       WHERE reset_token_hash = $1
       AND reset_token_expiry > NOW()`,
      [tokenHash]
    );
    return result.rows[0];
  }

  // Update password and clear token
  static async updatePassword(userId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           reset_token_hash = NULL,
           reset_token_expiry = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [passwordHash, userId]
    );
  }
}

module.exports = User;
