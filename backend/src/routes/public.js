const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Validate public registration slug
router.get('/join/:slug', publicController.validateSlug);
router.get('/join/:slug/:tournamentId', publicController.validateSlug);

// Submit registration payload
router.post('/join/:slug', publicController.registerPlayer);
router.post('/join/:slug/:tournamentId', publicController.registerPlayer);

// Player portal dashboard live data extraction
router.get('/tournament/:tournamentId/player/:playerIdent', publicController.getPlayerDashboard);

module.exports = router;
