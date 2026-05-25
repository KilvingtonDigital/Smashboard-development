const { validationResult } = require('express-validator');
const Tournament = require('../models/Tournament');
const pool = require('../config/database');

// Create tournament
exports.createTournament = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tournament_name, tournament_type, num_courts, tournament_data, event_date, registration_fee } = req.body;

    const tournament = await Tournament.create({
      user_id: req.user.id,
      tournament_name,
      tournament_type,
      num_courts,
      tournament_data,
      event_date,
      registration_fee
    });

    res.status(201).json({
      message: 'Tournament created successfully',
      tournament
    });
  } catch (error) {
    console.error('Create tournament error:', error);
    res.status(500).json({ error: 'Failed to create tournament' });
  }
};

// Get all tournaments for current user
exports.getTournaments = async (req, res) => {
  try {
    const tournaments = await Tournament.findByUserId(req.user.id);
    res.json({ tournaments });
  } catch (error) {
    console.error('Get tournaments error:', error);
    res.status(500).json({ error: 'Failed to get tournaments' });
  }
};

// Get single tournament
exports.getTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id, req.user.id);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    res.json({ tournament });
  } catch (error) {
    console.error('Get tournament error:', error);
    res.status(500).json({ error: 'Failed to get tournament' });
  }
};

// Update tournament
exports.updateTournament = async (req, res) => {
  try {
    const { tournament_name, tournament_type, num_courts, tournament_data, event_date, registration_fee } = req.body;

    const tournament = await Tournament.update(
      req.params.id,
      req.user.id,
      { tournament_name, tournament_type, num_courts, tournament_data, event_date, registration_fee }
    );

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    res.json({
      message: 'Tournament updated successfully',
      tournament
    });
  } catch (error) {
    console.error('Update tournament error:', error);
    res.status(500).json({ error: 'Failed to update tournament' });
  }
};

// Delete tournament
exports.deleteTournament = async (req, res) => {
  try {
    const tournament = await Tournament.delete(req.params.id, req.user.id);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    res.json({ message: 'Tournament deleted successfully' });
  } catch (error) {
    console.error('Delete tournament error:', error);
    res.status(500).json({ error: 'Failed to delete tournament' });
  }
};

// Activate tournament (sets this one as active, others as inactive)
exports.activateTournament = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const check = await Tournament.findById(id, req.user.id);
    if (!check) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Set all other tournaments for this user to inactive
    await pool.query(
      'UPDATE tournaments SET is_active_session = FALSE WHERE user_id = $1',
      [req.user.id]
    );

    // Set selected tournament to active
    const result = await pool.query(
      'UPDATE tournaments SET is_active_session = TRUE WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );

    res.json({
      success: true,
      message: 'Tournament activated successfully',
      tournament: result.rows[0]
    });
  } catch (error) {
    console.error('Activate tournament error:', error);
    res.status(500).json({ error: 'Failed to activate tournament' });
  }
};

// Get all players registered for a specific tournament
exports.getTournamentPlayers = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const check = await Tournament.findById(id, req.user.id);
    if (!check) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const result = await pool.query(
      `SELECT p.* 
       FROM players p
       JOIN tournament_registrations tr ON p.id = tr.player_id
       WHERE tr.tournament_id = $1
       ORDER BY p.player_name ASC`,
      [id]
    );

    res.json({ players: result.rows });
  } catch (error) {
    console.error('Get tournament players error:', error);
    res.status(500).json({ error: 'Failed to get tournament players' });
  }
};
