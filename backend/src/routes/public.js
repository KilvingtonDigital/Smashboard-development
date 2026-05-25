const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Validate public registration slug
router.get('/join/:slug', publicController.validateSlug);

// Submit registration payload
router.post('/join/:slug', publicController.registerPlayer);

// Spectator read-only bracket access
router.get('/bracket/:slug', publicController.getActiveBracket);

module.exports = router;
