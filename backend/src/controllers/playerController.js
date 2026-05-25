const { validationResult } = require('express-validator');
const Player = require('../models/Player');

// Create player
exports.createPlayer = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { player_name, dupr_rating, gender, email, phone } = req.body;

    const player = await Player.create({
      user_id: req.user.id,
      player_name,
      dupr_rating,
      gender,
      email,
      phone
    });

    res.status(201).json({
      message: 'Player created successfully',
      player
    });
  } catch (error) {
    console.error('Create player error:', error);
    res.status(500).json({ error: 'Failed to create player' });
  }
};

// Get all players (roster) for current user
exports.getPlayers = async (req, res) => {
  try {
    const players = await Player.findByUserId(req.user.id);
    res.json({ players });
  } catch (error) {
    console.error('Get players error:', error);
    res.status(500).json({ error: 'Failed to get players' });
  }
};

// Get single player
exports.getPlayer = async (req, res) => {
  try {
    const player = await Player.findById(req.params.id, req.user.id);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({ player });
  } catch (error) {
    console.error('Get player error:', error);
    res.status(500).json({ error: 'Failed to get player' });
  }
};

// Update player
exports.updatePlayer = async (req, res) => {
  try {
    const { player_name, dupr_rating, gender } = req.body;

    const player = await Player.update(
      req.params.id,
      req.user.id,
      { player_name, dupr_rating, gender }
    );

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({
      message: 'Player updated successfully',
      player
    });
  } catch (error) {
    console.error('Update player error:', error);
    res.status(500).json({ error: 'Failed to update player' });
  }
};

// Delete player
exports.deletePlayer = async (req, res) => {
  try {
    const player = await Player.delete(req.params.id, req.user.id);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({ message: 'Player deleted successfully' });
  } catch (error) {
    console.error('Delete player error:', error);
    res.status(500).json({ error: 'Failed to delete player' });
  }
};

// Bulk create players
exports.bulkCreatePlayers = async (req, res) => {
  try {
    const { players } = req.body;

    if (!Array.isArray(players) || players.length === 0) {
      return res.status(400).json({ error: 'Players array is required' });
    }

    const createdPlayers = await Player.bulkCreate(req.user.id, players);

    res.status(201).json({
      message: `${createdPlayers.length} players created successfully`,
      players: createdPlayers
    });
  } catch (error) {
    console.error('Bulk create players error:', error);
    res.status(500).json({ error: 'Failed to create players' });
  }
};
