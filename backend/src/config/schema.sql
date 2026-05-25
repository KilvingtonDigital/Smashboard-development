-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tournaments table to store tournament data
CREATE TABLE IF NOT EXISTS tournaments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tournament_name VARCHAR(255) NOT NULL,
  tournament_type VARCHAR(50) NOT NULL,
  num_courts INTEGER DEFAULT 1,
  tournament_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Players/Roster table
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  player_name VARCHAR(255) NOT NULL,
  dupr_rating DECIMAL(3, 2),
  gender VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_tournaments_user_id ON tournaments(user_id);
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- MIGRATION: Add First Name and Last Name columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

-- MIGRATION: Add Password Reset columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP;

-- MIGRATION: Add Public Registration columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_slug VARCHAR(50) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_name VARCHAR(100);

-- MIGRATION: Add active session flag to tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_active_session BOOLEAN DEFAULT FALSE;

-- MIGRATION: Ensure only one active session per user (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournaments_active_session_per_user
  ON tournaments (user_id)
  WHERE is_active_session = TRUE;


-- DEDUPLICATION MIGRATION: Clean up existing duplicate players
DELETE FROM players
WHERE id IN (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, LOWER(player_name) ORDER BY id ASC) as row_num
    FROM players
  ) t
  WHERE t.row_num > 1
);

-- Ensure unique players per user (case-insensitive name)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_player_per_user 
ON players (user_id, LOWER(player_name));

-- MIGRATION: Add Public Registration PII and Legal fields to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE players ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE players ADD COLUMN IF NOT EXISTS dupr_id VARCHAR(100);
ALTER TABLE players ADD COLUMN IF NOT EXISTS waiver_signed BOOLEAN DEFAULT FALSE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS waiver_timestamp TIMESTAMP;

-- MIGRATION: Add Public Registration PII and Legal fields to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE players ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE players ADD COLUMN IF NOT EXISTS dupr_id VARCHAR(100);
ALTER TABLE players ADD COLUMN IF NOT EXISTS waiver_signed BOOLEAN DEFAULT FALSE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS waiver_timestamp TIMESTAMP;

-- MIGRATION: Add age category to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS age_category VARCHAR(20) DEFAULT 'adult';

-- MIGRATION: Add division restriction gates to tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS restricted_skill VARCHAR(50) DEFAULT 'all';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS restricted_age VARCHAR(20) DEFAULT 'all';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS restricted_gender VARCHAR(10) DEFAULT 'all';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bracket_format VARCHAR(20) DEFAULT 'single_elim';

