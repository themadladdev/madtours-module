// server/src/services/tourStripeService.js
import Stripe from 'stripe';
import { config } from '../config/environment.js';
import { 
  confirmBooking,
  cancelBooking 
} from './tourBookingService.js';
import { pool } from '../db/db.js';

export const stripe = new Stripe(
  config.nodeEnv === 'production' 
    ? process.env.STRIPE_SECRET_KEY_PROD 
    : config.stripeSecretKey
);

/**
 * --- [REFACTOR] ---
 * Creates a PaymentIntent *before* a booking exists.
 * It only needs the total amount and minimal metadata.
 * It NO LONGER updates the database.
 */
export const createPaymentIntent = async (totalAmount, metadata = {}) => {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(totalAmount * 100), // Convert to cents
    currency: 'aud',
    metadata: metadata, // Pass in minimal metadata
    automatic_payment_methods: {
      enabled: true
    }
  });

  return paymentIntent; // Return the full PI object
};

/**
 * --- [NEW] ---
 * Updates an existing PaymentIntent with new metadata.
 * This is called *after* the booking is successfully created.
 */
export const updatePaymentIntentMetadata = async (paymentIntentId, bookingId) => {
  try {
    // Retrieve the PI to get its existing metadata
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    // Create new metadata object, preserving old and adding new
    const newMetadata = {
      ...paymentIntent.metadata,
      booking_id: bookingId.toString()
    };

    // Update the PI with the new, merged metadata
    const updatedPaymentIntent = await stripe.paymentIntents.update(
      paymentIntentId,
      { metadata: newMetadata }
    );
    
    return updatedPaymentIntent;
  } catch (error) {
    console.error(`Failed to update metadata for PI ${paymentIntentId}:`, error);
    // We don't throw here, as the PI is created. Log and continue.
    // This is a critical logging event.
  }
};


/**
 * Initiates a refund via Stripe for a Triage item.
 * Moves state to 'refund_stripe_pending'.
 *
 */
export const processRefund = async (bookingId, adminId, amount = null, reason = 'requested_by_customer') => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const bookingResult = await client.query(
      'SELECT * FROM tour_bookings WHERE id = $1 FOR UPDATE',
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      throw new Error('Booking not found');
    }
    const booking = bookingResult.rows[0];

    if (!booking.payment_intent_id) {
      throw new Error('No payment_intent_id to refund');
    }

    if (booking.payment_status === 'payment_none' || 
        booking.payment_status === 'payment_foc' ||
        booking.payment_status === 'payment_manual_pending') {
      throw new Error('No payment was ever collected to refund.');
    }
    
    if (booking.payment_status.startsWith('refund_') && booking.payment_status !== 'refund_stripe_failed') {
      throw new Error(`Booking already in a refund state: ${booking.payment_status}`);
    }

    const amountToRefund = amount !== null ? amount : booking.total_amount;
    const refundAmountInCents = Math.round(amountToRefund * 100);

    const refund = await stripe.refunds.create({
      payment_intent: booking.payment_intent_id,
      amount: refundAmountInCents,
      reason: reason,
      metadata: {
        booking_id: bookingId.toString(),
        refund_reason: reason
      }
    });

    // --- [REFACTOR] ---
    // Seat is CANCELLED, payment is PENDING refund.
    // This moves it OUT of the Triage queue.
    await client.query(
      `UPDATE tour_bookings 
       SET seat_status = 'seat_cancelled',
           payment_status = 'refund_stripe_pending',
           refund_amount = $1,
           cancellation_reason = $2,
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE id = $3`,
      [amountToRefund, reason, bookingId]
    );

    // Release inventory if seat was confirmed or in triage
    if (booking.seat_status === 'seat_confirmed' || booking.seat_status === 'triage') {
        await client.query(
          `UPDATE tour_instances 
           SET booked_seats = booked_seats - $1, updated_at = NOW()
           WHERE id = $2`,
          [booking.seats, booking.tour_instance_id]
        );
    }
    
    await client.query(
      `INSERT INTO tour_booking_history 
       (booking_id, previous_status, new_status, changed_by_admin, reason)
       VALUES ($1, $2, 'seat_cancelled', $3, $4)`,
      [bookingId, booking.seat_status, adminId, `Refund initiated: ${reason}`]
    );
     await client.query(
      `INSERT INTO tour_booking_history 
       (booking_id, previous_status, new_status, changed_by_admin, reason)
       VALUES ($1, $2, 'refund_stripe_pending', $3, $4)`,
      [bookingId, `payment: ${booking.payment_status}`, adminId, `Stripe refund ${refund.id} created`]
    );

    await client.query('COMMIT');
    return refund;

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in processRefund:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * --- [NEW] ---
 * Retries a failed Stripe refund.
 * Moves state from 'refund_stripe_failed' back to 'refund_stripe_pending'.
 * The booking remains in 'triage' state.
 */
export const retryStripeRefund = async (bookingId, adminId) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const bookingResult = await client.query(
      'SELECT * FROM tour_bookings WHERE id = $1 FOR UPDATE', 
      [bookingId]
    );
    const booking = bookingResult.rows[0];

    if (!booking) throw new Error('Booking not found');
    if (booking.seat_status !== 'triage' || booking.payment_status !== 'refund_stripe_failed') {
      throw new Error('Booking is not in a state that allows a refund retry.');
    }
    if (!booking.payment_intent_id) {
      throw new Error('Cannot retry Stripe refund: No PaymentIntent ID found.');
    }

    // Create a *new* refund object for the *same* payment intent
    const refund = await stripe.refunds.create({
      payment_intent: booking.payment_intent_id,
      amount: Math.round(booking.refund_amount * 100), // Use the original refund amount
      reason: 'Retry of failed refund',
      metadata: {
        booking_id: bookingId.toString(),
        retry_by_admin: adminId.toString()
      }
    });

    // Update payment_status back to pending
    await client.query(
      `UPDATE tour_bookings
       SET payment_status = 'refund_stripe_pending',
           admin_notes = COALESCE(admin_notes, '') || '\nRefund retried by admin ${adminId}. New refund ID: ${refund.id}',
           updated_at = NOW()
       WHERE id = $1`,
      [bookingId]
    );

    // Log this action
    await client.query(
      `INSERT INTO tour_booking_history
       (booking_id, previous_status, new_status, changed_by_admin, reason)
       VALUES ($1, $2, 'refund_stripe_pending', $3, $4)`,
      [bookingId, `payment: ${booking.payment_status}`, adminId, `Refund retry initiated. New ID: ${refund.id}`]
    );
    
    await client.query('COMMIT');
    return refund;

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in retryStripeRefund:', error);
    throw error;
  } finally {
    client.release();
  }
};


/**
 * --- [FIX] ---
 * This function is now called by the controller and receives
 * the *already verified* event object.
 * We are REMOVING the redundant signature verification.
 */
export const handleWebhook = async (event) => {
  // const webhookSecret = ...
  // let event;
  // try {
  //   event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  // } catch (error) {
  //   throw new Error(`Webhook signature verification failed: ${error.message}`);
  // }
  // --- [END FIX: Removed redundant verification] ---


  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      // This is the correct log you saw in your last test
      console.log(`[Stripe Webhook] ✅ Payment Succeeded for: ${event.data.object.id}`);
      await handlePaymentSuccess(event.data.object);
      break;

    case 'payment_intent.payment_failed':
      // This is the correct log you saw in your last test
      console.log(`[Stripe Webhook] ❌ Payment Failed for: ${event.data.object.id}`);
      await handlePaymentFailure(event.data.object);
      break;

    case 'charge.refund.updated':
      const refund = event.data.object;
      if (refund.status === 'succeeded') {
        await handleRefundSuccess(refund);
      } else if (refund.status === 'failed') {
        // --- [REFACTOR] Use the new, correct logic ---
        await handleRefundFailure(refund);
      }
      break;

    default:
      // This is the correct log you saw in your last test
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
  }

  return { received: true };
};

const handlePaymentSuccess = async (paymentIntent) => {
  // --- [FIX] ---
  // Webhook now finds the booking ID from the metadata
  const bookingId = paymentIntent.metadata.booking_id;
  if (!bookingId) {
    console.error(`Webhook Error: No booking_id in metadata for PI: ${paymentIntent.id}`);
    return; // Cannot proceed
  }
  
  const bookingResult = await pool.query(
    'SELECT id, seat_status FROM tour_bookings WHERE id = $1',
    [bookingId]
  );

  if (bookingResult.rows.length === 0) {
     console.error(`Webhook Error: No booking found for Booking ID: ${bookingId}`);
     return;
  }
  
  const booking = bookingResult.rows[0];
  
  if (booking.seat_status === 'seat_pending') {
    await confirmBooking(booking.id);
  } else {
    console.log(`Webhook Warning: Payment success for booking ${booking.id} which is already in status ${booking.seat_status}.`);
  }
};

const handlePaymentFailure = async (paymentIntent) => {
  // --- [FIX] ---
  // Webhook now finds the booking ID from the metadata
  const bookingId = paymentIntent.metadata.booking_id;
  if (!bookingId) {
    console.error(`Webhook Error: No booking_id in metadata for failed PI: ${paymentIntent.id}`);
    return; // Cannot proceed
  }

  const bookingResult = await pool.query(
    'SELECT id, seat_status FROM tour_bookings WHERE id = $1',
    [bookingId]
  );

  if (bookingResult.rows.length === 0) {
     console.error(`Webhook Error: No booking found for failed Booking ID: ${bookingId}`);
     return;
  }
  
  const booking = bookingResult.rows[0];

  if (booking.seat_status === 'seat_pending') {
    await cancelBooking(booking.id, 'Payment failed or was cancelled');
  } else {
     console.log(`Webhook Warning: Payment failure for booking ${booking.id} which is already in status ${booking.seat_status}.`);
  }
};

const handleRefundSuccess = async (refund) => {
  // --- [FIX] ---
  // Refund webhooks find the booking via metadata
  const bookingId = refund.metadata.booking_id;
  if (!bookingId) {
    console.error(`Webhook Error: No booking_id in metadata for refund: ${refund.id}`);
    return; // Cannot proceed
  }

  const bookingResult = await pool.query(
    'SELECT id, payment_status FROM tour_bookings WHERE id = $1',
    [bookingId]
  );
  
  if (bookingResult.rows.length === 0) {
     console.error(`Webhook Error: No booking found for refunded Booking ID: ${bookingId}`);
     return;
  }
  
  const booking = bookingResult.rows[0];
  
  if (booking.payment_status === 'refund_stripe_pending') {
    await pool.query(
      `UPDATE tour_bookings 
       SET payment_status = 'refund_stripe_success',
           refunded_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [booking.id]
    );
    await pool.query(
      `INSERT INTO tour_booking_history (booking_id, previous_status, new_status, reason)
       VALUES ($1, 'refund_stripe_pending', 'refund_stripe_success', $2)`,
      [booking.id, `Stripe refund ${refund.id} succeeded`]
    );
  } else {
    console.log(`Webhook Warning: Refund success for booking ${booking.id} with status ${booking.payment_status}.`);
  }
};

/**
 * --- [REFACTORED] ---
 * Handles failed refund webhook.
 * Moves state from 'refund_stripe_pending' to 'refund_stripe_failed'.
 * **CRITICALLY: Moves seat_status from 'seat_cancelled' back to 'triage'.**
 * This puts the failed refund back in the admin's Triage queue.
 */
const handleRefundFailure = async (refund) => {
  // --- [FIX] ---
  // Refund webhooks find the booking via metadata
  const bookingId = refund.metadata.booking_id;
  if (!bookingId) {
    console.error(`Webhook Error: No booking_id in metadata for failed refund: ${refund.id}`);
    return; // Cannot proceed
  }
    
  const bookingResult = await pool.query(
    'SELECT id, seat_status, payment_status FROM tour_bookings WHERE id = $1',
    [bookingId]
  );
  
  if (bookingResult.rows.length === 0) {
     console.error(`Webhook Error: No booking found for failed refund Booking ID: ${bookingId}`);
     return;
  }
  
  const booking = bookingResult.rows[0];
  
  // Only act if it was pending a refund.
  if (booking.payment_status === 'refund_stripe_pending') {
    await pool.query(
      `UPDATE tour_bookings 
       SET seat_status = 'triage',
           payment_status = 'refund_stripe_failed',
           admin_notes = COALESCE(admin_notes, '') || '\nStripe refund ${refund.id} failed: ${refund.failure_reason}',
           updated_at = NOW()
       WHERE id = $1`,
      [booking.id]
    );
     // Log the two state changes
    await pool.query(
      `INSERT INTO tour_booking_history (booking_id, previous_status, new_status, reason)
       VALUES ($1, 'refund_stripe_pending', 'refund_stripe_failed', $2)`,
      [booking.id, `StF_REFUND_FAIL: ${refund.failure_reason}`]
    );
    await pool.query(
      `INSERT INTO tour_booking_history (booking_id, previous_status, new_status, reason)
       VALUES ($1, 'seat_cancelled', 'triage', $2)`,
      [booking.id, 'Refund failed, returning to Triage queue']
    );
  } else {
     console.log(`Webhook Warning: Refund failure for booking ${booking.id} with status ${booking.payment_status}.`);
  }
};