const User = require('../models/User');
const Player = require('../models/Player');
const pool = require('../config/database');

// Validate slug wrapper (supports optional tournamentId for customized event headers)
exports.validateSlug = async (req, res) => {
  try {
    const { slug, tournamentId } = req.params;
    const user = await User.findByRegistrationSlug(slug);
    
    if (!user) {
      return res.status(404).json({ error: 'Invalid or expired registration link' });
    }

    const orgName = user.organization_name || `${user.first_name || 'The Organizer'}'s`;
    let tournamentName = '';

    if (tournamentId) {
      const tResult = await pool.query(
        'SELECT tournament_name FROM tournaments WHERE id = $1 AND user_id = $2',
        [tournamentId, user.id]
      );
      if (tResult.rows.length > 0) {
        tournamentName = tResult.rows[0].tournament_name;
      } else {
        return res.status(404).json({ error: 'Tournament not found' });
      }
    }
    
    res.json({
      success: true,
      orgName,
      tournamentName
    });
  } catch (error) {
    console.error('Slug validation error:', error);
    res.status(500).json({ error: 'Failed to validate registration link' });
  }
};

// Register via public link (supports optional tournamentId for junction table linking)
exports.registerPlayer = async (req, res) => {
  try {
    const { slug, tournamentId } = req.params;
    const { firstName, lastName, rating, gender, email, phone, duprId, waiverSigned } = req.body;

    const user = await User.findByRegistrationSlug(slug);
    if (!user) {
      return res.status(404).json({ error: 'Invalid registration link' });
    }

    if (!firstName || !rating) {
      return res.status(400).json({ error: 'First name and DUPR rating are required' });
    }

    if (!email || !phone) {
      return res.status(400).json({ error: 'Email address and mobile phone number are strictly required for registration.' });
    }

    if (!waiverSigned) {
      return res.status(400).json({ error: 'You must agree to the Terms of Service and Liability Waiver to register.' });
    }

    const fullName = lastName ? `${firstName} ${lastName}` : firstName;
    
    // Add or update in players table via Player model
    const newPlayer = await Player.create({
      user_id: user.id,
      player_name: fullName,
      dupr_rating: rating,
      gender: gender || 'male',
      email,
      phone,
      dupr_id: duprId,
      waiver_signed: waiverSigned
    });

    // If registering for a specific tournament, link them in the junction table
    if (tournamentId) {
      await pool.query(
        `INSERT INTO tournament_registrations (tournament_id, player_id)
         VALUES ($1, $2)
         ON CONFLICT (tournament_id, player_id) DO NOTHING`,
        [tournamentId, newPlayer.id]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Player registered successfully',
      player: newPlayer
    });

  } catch (error) {
    console.error('Public registration error:', error);
    res.status(500).json({ error: 'Failed to complete registration' });
  }
};
