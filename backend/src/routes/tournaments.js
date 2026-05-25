const express = require('express');
const { body } = require('express-validator');
const tournamentController = require('../controllers/tournamentController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All tournament routes require authentication
router.use(authMiddleware);

// Validation rules
const tournamentValidation = [
  body('tournament_name')
    .trim()
    .notEmpty()
    .withMessage('Tournament name is required'),
  body('tournament_type')
    .trim()
    .notEmpty()
    .withMessage('Tournament type is required'),
  body('num_courts')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Number of courts must be at least 1')
];

// Routes
router.post('/', tournamentValidation, tournamentController.createTournament);
router.get('/', tournamentController.getTournaments);
router.get('/:id', tournamentController.getTournament);
router.put('/:id', tournamentController.updateTournament);
router.delete('/:id', tournamentController.deleteTournament);
router.post('/:id/activate', tournamentController.activateTournament);
router.get('/:id/players', tournamentController.getTournamentPlayers);

module.exports = router;
