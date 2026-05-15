const User = require('../models/User');
const Player = require('../models/Player');

// Validate slug wrapper
exports.validateSlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const user = await User.findByRegistrationSlug(slug);
    
    if (!user) {
      return res.status(404).json({ error: 'Invalid or expired registration link' });
    }

    const orgName = user.organization_name || `${user.first_name || 'The Organizer'}'s`;
    
    res.json({
      success: true,
      orgName
    });
  } catch (error) {
    console.error('Slug validation error:', error);
    res.status(500).json({ error: 'Failed to validate registration link' });
  }
};

// Register via public link
exports.registerPlayer = async (req, res) => {
  try {
    const { slug } = req.params;
    const { firstName, lastName, rating, gender } = req.body;

    const user = await User.findByRegistrationSlug(slug);
    if (!user) {
      return res.status(404).json({ error: 'Invalid registration link' });
    }

    if (!firstName || !rating) {
      return res.status(400).json({ error: 'First name and DUPR rating are required' });
    }

    const fullName = lastName ? `${firstName} ${lastName}` : firstName;
    
    // Add to players table via Player model
    const newPlayer = await Player.create({
      user_id: user.id,
      player_name: fullName,
      dupr_rating: rating,
      gender: gender || 'male'
    });

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
