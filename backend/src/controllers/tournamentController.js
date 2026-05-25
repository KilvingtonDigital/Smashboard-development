const { validationResult } = require('express-validator');
const Tournament = require('../models/Tournament');

// Create tournament
exports.createTournament = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tournament_name, tournament_type, num_courts, tournament_data, restricted_skill, restricted_age, restricted_gender, bracket_format } = req.body;

    const tournament = await Tournament.create({
      user_id: req.user.id,
      tournament_name,
      tournament_type,
      num_courts,
      tournament_data,
      restricted_skill,
      restricted_age,
      restricted_gender,
      bracket_format
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
    const { tournament_name, tournament_type, num_courts, tournament_data, restricted_skill, restricted_age, restricted_gender, bracket_format } = req.body;

    const tournament = await Tournament.update(
      req.params.id,
      req.user.id,
      { tournament_name, tournament_type, num_courts, tournament_data, restricted_skill, restricted_age, restricted_gender, bracket_format }
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
