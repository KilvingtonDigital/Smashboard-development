const express = require('express');
const { body } = require('express-validator');
const playerController = require('../controllers/playerController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All player routes require authentication
router.use(authMiddleware);

// Validation rules
const playerValidation = [
  body('player_name')
    .trim()
    .notEmpty()
    .withMessage('Player name is required'),
  body('dupr_rating')
    .optional()
    .isFloat({ min: 0, max: 10 })
    .withMessage('DUPR rating must be between 0 and 10'),
  body('gender')
    .optional()
    .isIn(['Male', 'Female', 'male', 'female', 'Other', 'other', ''])
    .withMessage('Invalid gender value'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required')
    .isEmail()
    .withMessage('Must be a valid email address'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
];

// Routes
router.post('/', playerValidation, playerController.createPlayer);
router.post('/bulk', playerController.bulkCreatePlayers);
router.get('/', playerController.getPlayers);
router.get('/:id', playerController.getPlayer);
router.put('/:id', playerController.updatePlayer);
router.delete('/:id', playerController.deletePlayer);

module.exports = router;
