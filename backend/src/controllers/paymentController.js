const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const pool = require('../config/database');
const Player = require('../models/Player');

/**
 * POST /api/payments/checkout-session
 * Generates a Stripe Checkout Session for registering to a paid tournament.
 */
exports.createCheckoutSession = async (req, res) => {
  try {
    const { tournamentId, firstName, lastName, rating, gender, email, phone, duprId, waiverSigned } = req.body;

    if (!tournamentId || !firstName || !rating || !email || !phone) {
      return res.status(400).json({ error: 'Missing mandatory registration fields.' });
    }

    // 1. Fetch tournament details and entry fee
    const tResult = await pool.query(
      'SELECT id, tournament_name, user_id, registration_fee FROM tournaments WHERE id = $1',
      [tournamentId]
    );

    if (tResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const tournament = tResult.rows[0];
    const fee = Number(tournament.registration_fee || 0);

    if (fee <= 0) {
      return res.status(400).json({ error: 'This tournament is free. Use regular registration.' });
    }

    const fullName = lastName ? `${firstName} ${lastName}` : firstName;

    // 2. Build secure success/cancel URLs relative to incoming host
    const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    const successUrl = `${origin}/join/slug/${tournamentId}?payment=success`;
    const cancelUrl = `${origin}/join/slug/${tournamentId}?payment=cancel`;

    // 3. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `DinkSync Registration: ${tournament.tournament_name}`,
              description: `Entry ticket for player ${fullName} 🏓`,
            },
            unit_amount: Math.round(fee * 100), // in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: email,
      metadata: {
        tournament_id: tournamentId.toString(),
        user_id: tournament.user_id.toString(),
        first_name: firstName,
        last_name: lastName || '',
        rating: rating.toString(),
        gender: gender || 'male',
        email,
        phone,
        dupr_id: duprId || '',
        waiver_signed: waiverSigned ? 'true' : 'false',
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    res.json({ success: true, url: session.url });
  } catch (error) {
    console.error('[STRIPE CHECKOUT ERROR] Session creation failed:', error);
    res.status(500).json({ error: 'Failed to initiate checkout session.' });
  }
};

/**
 * POST /api/payments/webhook
 * Receives verified Stripe webhooks to record secure payments.
 */
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error(`⚠️ Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the completed checkout session event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const metadata = session.metadata;

    if (!metadata || !metadata.tournament_id) {
      console.warn('⚠️ Checkout completed with missing metadata. Skipped processing.');
      return res.json({ received: true });
    }

    try {
      const tournamentId = parseInt(metadata.tournament_id);
      const userId = parseInt(metadata.user_id);
      const firstName = metadata.first_name;
      const lastName = metadata.last_name;
      const rating = parseFloat(metadata.rating);
      const gender = metadata.gender;
      const email = metadata.email;
      const phone = metadata.phone;
      const duprId = metadata.dupr_id;
      const waiverSigned = metadata.waiver_signed === 'true';

      const fullName = lastName ? `${firstName} ${lastName}` : firstName;
      const amountPaid = session.amount_total ? (session.amount_total / 100) : 0.00;
      const sessionId = session.id;

      console.log(`[STRIPE SUCCESS] Payment received for ${fullName} - $${amountPaid}`);

      // 1. Add/Update master Player
      const newPlayer = await Player.create({
        user_id: userId,
        player_name: fullName,
        dupr_rating: rating,
        gender: gender || 'male',
        email,
        phone,
        dupr_id: duprId,
        waiver_signed: waiverSigned
      });

      // 2. Link in tournament_registrations with paid status
      await pool.query(
        `INSERT INTO tournament_registrations (tournament_id, player_id, payment_status, payment_session_id, payment_amount)
         VALUES ($1, $2, 'paid', $3, $4)
         ON CONFLICT (tournament_id, player_id) 
         DO UPDATE SET payment_status = 'paid', payment_session_id = EXCLUDED.payment_session_id, payment_amount = EXCLUDED.payment_amount`,
        [tournamentId, newPlayer.id, sessionId, amountPaid]
      );

      // 3. Inject player directly into active tournament session's data
      const tResult = await pool.query(
        'SELECT tournament_data FROM tournaments WHERE id = $1',
        [tournamentId]
      );

      if (tResult.rows.length > 0) {
        const data = tResult.rows[0].tournament_data || {};
        const players = data.players || [];
        
        const cleanIdent = email.toLowerCase().trim();
        const cleanPhoneIdent = phone.replace(/\D/g, '');

        let matchedIdx = players.findIndex(p => {
          const pEmail = p.email ? p.email.toString().trim().toLowerCase() : '';
          const pPhone = p.phone ? p.phone.toString().replace(/\D/g, '') : '';
          const pId = p.id ? p.id.toString() : '';
          return pEmail === cleanIdent || (cleanPhoneIdent && pPhone === cleanPhoneIdent) || pId === newPlayer.id.toString();
        });

        if (matchedIdx === -1) {
          players.push({
            id: newPlayer.id,
            name: newPlayer.player_name,
            rating: Number(newPlayer.dupr_rating),
            gender: newPlayer.gender,
            email: newPlayer.email,
            phone: newPlayer.phone,
            present: true // Instantly check them in
          });
        } else {
          players[matchedIdx].present = true;
          players[matchedIdx].name = newPlayer.player_name;
          players[matchedIdx].rating = Number(newPlayer.dupr_rating);
          players[matchedIdx].gender = newPlayer.gender;
        }

        await pool.query(
          'UPDATE tournaments SET tournament_data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [JSON.stringify({ ...data, players }), tournamentId]
        );
        console.log(`[STRIPE COMPLETE] Player ${fullName} successfully rostered & checked-in!`);
      }
    } catch (dbErr) {
      console.error('[STRIPE WEBHOOK ERROR] DB operations failed:', dbErr);
      return res.status(500).json({ error: 'Failed to record registration details.' });
    }
  }

  res.json({ received: true });
};
