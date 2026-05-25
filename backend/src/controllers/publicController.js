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

// Retrieve live tournament state for player dashboard
exports.getPlayerDashboard = async (req, res) => {
  try {
    const { tournamentId, playerIdent } = req.params;

    const tResult = await pool.query(
      'SELECT id, tournament_name, tournament_type, tournament_data, is_active_session FROM tournaments WHERE id = $1',
      [tournamentId]
    );

    if (tResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const tournament = tResult.rows[0];
    const data = tournament.tournament_data || {};
    const players = data.players || [];
    const rounds = data.rounds || [];
    const courtStates = data.courtStates || [];
    const currentRound = data.currentRound || 0;

    const cleanIdent = playerIdent.toString().trim().toLowerCase();
    const cleanPhoneIdent = cleanIdent.replace(/\D/g, '');

    // Match player in roster
    const player = players.find(p => {
      const pEmail = p.email ? p.email.toString().trim().toLowerCase() : '';
      const pPhone = p.phone ? p.phone.toString().replace(/\D/g, '') : '';
      const pId = p.id ? p.id.toString() : '';
      return pEmail === cleanIdent || (cleanPhoneIdent && pPhone === cleanPhoneIdent) || pId === cleanIdent;
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found in this tournament roster' });
    }

    const matchHistory = [];
    let currentMatch = null;
    let nextMatch = null;
    let isStandby = false;

    // Helper helper to map partner and opponents
    const formatMatchDetails = (match, isP1, isP2, isP3, isP4, roundIdx) => {
      const formatted = {
        roundIndex: roundIdx + 1,
        courtNumber: match.courtNumber || match.courtIndex + 1 || null,
        partner: null,
        opponents: [],
        status: match.status || 'scheduled',
        score1: match.score1 || 0,
        score2: match.score2 || 0,
        winner: match.winner || null
      };

      if (match.gameFormat === 'singles') {
        formatted.opponents = isP1 ? [match.player2] : [match.player1];
      } else {
        if (isP1) {
          formatted.partner = match.player3;
          formatted.opponents = [match.player2, match.player4];
        } else if (isP3) {
          formatted.partner = match.player1;
          formatted.opponents = [match.player2, match.player4];
        } else if (isP2) {
          formatted.partner = match.player4;
          formatted.opponents = [match.player1, match.player3];
        } else if (isP4) {
          formatted.partner = match.player2;
          formatted.opponents = [match.player1, match.player3];
        }
      }
      return formatted;
    };

    // Parse all rounds for history and future schedules
    rounds.forEach((round, roundIdx) => {
      const roundMatches = round.matches || [];
      const roundStandbys = round.standby || [];
      const isStandbyInRound = roundStandbys.some(s => s.id === player.id);

      roundMatches.forEach(match => {
        const isP1 = match.player1 && match.player1.id === player.id;
        const isP2 = match.player2 && match.player2.id === player.id;
        const isP3 = match.player3 && match.player3.id === player.id;
        const isP4 = match.player4 && match.player4.id === player.id;

        if (isP1 || isP2 || isP3 || isP4) {
          const formatted = formatMatchDetails(match, isP1, isP2, isP3, isP4, roundIdx);
          if (formatted.status === 'completed') {
            matchHistory.push(formatted);
          } else {
            if (roundIdx === currentRound) {
              currentMatch = formatted;
            } else if (roundIdx > currentRound && !nextMatch) {
              nextMatch = formatted;
            }
          }
        }
      });

      if (roundIdx === currentRound && isStandbyInRound) {
        isStandby = true;
      }
    });

    // Check if player is currently active in live courtStates
    courtStates.forEach((court, courtIdx) => {
      const match = court.currentMatch;
      if (!match) return;

      const isP1 = match.player1 && match.player1.id === player.id;
      const isP2 = match.player2 && match.player2.id === player.id;
      const isP3 = match.player3 && match.player3.id === player.id;
      const isP4 = match.player4 && match.player4.id === player.id;

      if (isP1 || isP2 || isP3 || isP4) {
        const formatted = formatMatchDetails(match, isP1, isP2, isP3, isP4, currentRound);
        formatted.status = 'live';
        formatted.courtNumber = courtIdx + 1;
        currentMatch = formatted;
      }
    });

    res.json({
      success: true,
      tournament: {
        id: tournament.id,
        name: tournament.tournament_name,
        type: tournament.tournament_type,
        isActive: tournament.is_active_session,
        currentRound: currentRound + 1
      },
      player: {
        id: player.id,
        name: player.player_name,
        rating: player.dupr_rating,
        gender: player.gender
      },
      currentMatch,
      nextMatch,
      isStandby,
      matchHistory
    });

  } catch (error) {
    console.error('Player dashboard API error:', error);
    res.status(500).json({ error: 'Failed to retrieve player dashboard data' });
  }
};
