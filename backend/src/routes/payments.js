const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Route to initiate a hosted Stripe checkout session (Public)
router.post('/checkout-session', paymentController.createCheckoutSession);

module.exports = router;
