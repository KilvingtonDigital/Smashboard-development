const User = require('../models/User');
const Player = require('../models/Player');
const pool = require('../config/database');

// Validate slug wrapper
exports.validateSlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const user = await User.findByRegistrationSlug(slug);
    
    if (!user) {
      return res.status(404).json({ error: 'Invalid or expired registration link' });
    }

    const orgName = user.organization_name || `${user.first_name || 'The Organizer'}'s`;
    
    // Check for an active tournament
    const activeTournamentResult = await pool.query(
      'SELECT * FROM tournaments WHERE user_id = $1 AND is_active_session = TRUE LIMIT 1',
      [user.id]
    );
    
    const activeTournament = activeTournamentResult.rows[0] || null;

    res.json({
      success: true,
      orgName,
      activeTournament: activeTournament ? {
        id: activeTournament.id,
        tournament_name: activeTournament.tournament_name,
        tournament_type: activeTournament.tournament_type,
        restricted_skill: activeTournament.restricted_skill,
        restricted_age: activeTournament.restricted_age,
        restricted_gender: activeTournament.restricted_gender,
        bracket_format: activeTournament.bracket_format
      } : null
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
    const { firstName, lastName, rating, gender, email, phone, duprId, waiverSigned, ageCategory } = req.body;

    const user = await User.findByRegistrationSlug(slug);
    if (!user) {
      return res.status(404).json({ error: 'Invalid registration link' });
    }

    if (!firstName || !rating) {
      return res.status(400).json({ error: 'First name and DUPR rating are required' });
    }

    if (!waiverSigned) {
      return res.status(400).json({ error: 'You must agree to the Terms of Service and Liability Waiver to register.' });
    }

    // Fetch active tournament constraints if any
    const activeTournamentResult = await pool.query(
      'SELECT * FROM tournaments WHERE user_id = $1 AND is_active_session = TRUE LIMIT 1',
      [user.id]
    );
    const activeTournament = activeTournamentResult.rows[0];

    if (activeTournament) {
      // 1. Gender check
      const allowedGender = activeTournament.restricted_gender || 'all';
      if (allowedGender !== 'all') {
        const playerGender = (gender || 'male').toLowerCase();
        if (allowedGender === 'men' && playerGender !== 'male') {
          return res.status(400).json({ error: "Registration locked: This tournament is restricted to Men's divisions only." });
        }
        if (allowedGender === 'women' && playerGender !== 'female') {
          return res.status(400).json({ error: "Registration locked: This tournament is restricted to Women's divisions only." });
        }
      }

      // 2. Age check
      const allowedAge = activeTournament.restricted_age || 'all';
      if (allowedAge !== 'all') {
        const playerAge = (ageCategory || 'adult').toLowerCase();
        if (allowedAge === 'juniors' && playerAge !== 'junior') {
          return res.status(400).json({ error: "Registration locked: This tournament is restricted to Juniors (Under 18) only." });
        }
        if (allowedAge === 'adults' && playerAge !== 'adult') {
          return res.status(400).json({ error: "Registration locked: This tournament is restricted to Adults (18-49) only." });
        }
        if (allowedAge === 'seniors' && playerAge !== 'senior') {
          return res.status(400).json({ error: "Registration locked: This tournament is restricted to Seniors (50+) only." });
        }
      }

      // 3. Skill rating check
      const allowedSkill = activeTournament.restricted_skill || 'all';
      if (allowedSkill !== 'all') {
        const playerRating = parseFloat(rating);
        if (isNaN(playerRating)) {
          return res.status(400).json({ error: "A valid DUPR rating is required to verify division eligibility." });
        }
        
        let minRating = 0;
        let maxRating = 10;
        let skillLabel = "";
        
        if (allowedSkill === '2.5-2.9') { minRating = 2.5; maxRating = 2.99; skillLabel = "Novice (2.5-2.99)"; }
        else if (allowedSkill === '3.0-3.4') { minRating = 3.0; maxRating = 3.49; skillLabel = "Intermediate (3.0-3.49)"; }
        else if (allowedSkill === '3.5-3.9') { minRating = 3.5; maxRating = 3.99; skillLabel = "High Intermediate (3.5-3.99)"; }
        else if (allowedSkill === '4.0-4.4') { minRating = 4.0; maxRating = 4.49; skillLabel = "Advanced (4.0-4.49)"; }
        else if (allowedSkill === '4.5-5.0') { minRating = 4.5; maxRating = 5.09; skillLabel = "High Advanced (4.5-5.09)"; }
        else if (allowedSkill === 'semi_pro') { minRating = 5.1; maxRating = 5.49; skillLabel = "Semi-Pro (5.1-5.49)"; }
        else if (allowedSkill === 'pro') { minRating = 5.5; maxRating = 10.0; skillLabel = "Professional (5.5+)"; }
        
        if (skillLabel && (playerRating < minRating || playerRating > maxRating)) {
          return res.status(400).json({ error: `Registration locked: This tournament is restricted to the ${skillLabel} skill division. Your DUPR rating is ${playerRating}.` });
        }
      }
    }

    const fullName = lastName ? `${firstName} ${lastName}` : firstName;
    
    // Add to players table via Player model
    const newPlayer = await Player.create({
      user_id: user.id,
      player_name: fullName,
      dupr_rating: rating,
      gender: gender || 'male',
      email,
      phone,
      dupr_id: duprId,
      waiver_signed: waiverSigned,
      age_category: ageCategory || 'adult'
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
