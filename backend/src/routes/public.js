const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Validate public registration slug
router.get('/join/:slug', publicController.validateSlug);

// Submit registration payload
router.post('/join/:slug', publicController.registerPlayer);

module.exports = router;
