// ==========================================
// SERVICES: Stripe Service
// server/src/services/tourStripeService.js
// ==========================================

import Stripe from 'stripe';
import { config } from '../config/environment.js';
import { updateBookingPaymentIntent, confirmBooking } from './tourBookingService.js';
import { pool } from '../db/db.js';

const stripe = new Stripe(
  config.nodeEnv === 'production' 
    ? process.env.STRIPE_SECRET_KEY_PROD 
    : process.env.STRIPE_SECRET_KEY_DEV
);

export const createPaymentIntent = async (booking) => {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(booking.total_amount * 100), // Convert to cents
    currency: 'aud',
    metadata: {
      booking_id: booking.id.toString(),
      booking_reference: booking.booking_reference
    },
    automatic_payment_methods: {
      enabled: true
    }
  });

  await updateBookingPaymentIntent(booking.id, paymentIntent.id);

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id
  };
};

export const processRefund = async (bookingId, amount = null, reason = 'requested_by_customer') => {
  const bookingResult = await pool.query(
    'SELECT * FROM bookings WHERE id = $1',
    [bookingId]
  );

  if (bookingResult.rows.length === 0) {
    throw new Error('Booking not found');
  }

  const booking = bookingResult.rows[0];

  if (!booking.payment_intent_id) {
    throw new Error('No payment to refund');
  }

  if (booking.payment_status === 'refunded') {
    throw new Error('Booking already refunded');
  }

  const refundAmount = amount ? Math.round(amount * 100) : undefined;

  const refund = await stripe.refunds.create({
    payment_intent: booking.payment_intent_id,
    amount: refundAmount,
    reason: 'requested_by_customer',
    metadata: {
      booking_id: bookingId.toString(),
      refund_reason: reason
    }
  });

  // Update booking
  await pool.query(
    `UPDATE bookings 
     SET payment_status = 'refunded',
         refund_amount = $1,
         refunded_at = NOW(),
         updated_at = NOW()
     WHERE id = $2`,
    [refund.amount / 100, bookingId]
  );

  return refund;
};

export const handleWebhook = async (rawBody, signature) => {
  const webhookSecret = config.nodeEnv === 'production'
    ? process.env.STRIPE_WEBHOOK_SECRET_PROD
    : process.env.STRIPE_WEBHOOK_SECRET_DEV;

  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    throw new Error(`Webhook signature verification failed: ${error.message}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object);
      break;

    case 'payment_intent.payment_failed':
      await handlePaymentFailure(event.data.object);
      break;

    case 'charge.refunded':
      await handleRefundCompleted(event.data.object);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return { received: true };
};

const handlePaymentSuccess = async (paymentIntent) => {
  const result = await pool.query(
    'SELECT id FROM bookings WHERE payment_intent_id = $1',
    [paymentIntent.id]
  );

  if (result.rows.length > 0) {
    await confirmBooking(result.rows[0].id);
  }
};

const handlePaymentFailure = async (paymentIntent) => {
  await pool.query(
    `UPDATE bookings 
     SET payment_status = 'failed', updated_at = NOW()
     WHERE payment_intent_id = $1`,
    [paymentIntent.id]
  );
};

const handleRefundCompleted = async (charge) => {
  // Refund completion is already handled in processRefund
  // This is just for logging/additional verification
  console.log(`Refund completed for charge: ${charge.id}`);
};