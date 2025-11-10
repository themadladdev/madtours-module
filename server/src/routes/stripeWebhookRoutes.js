// server/src/routes/stripeWebhookRoutes.js
import express from 'express';
import * as stripeWebhookController from '../controllers/stripeWebhookController.js';

const router = express.Router();

// POST   /api/v1/stripe/webhook
// This is the single endpoint that Stripe will send all events to.
router.post('/webhook', stripeWebhookController.handleStripeWebhook);

export default router;