// ==========================================
// server/src/services/tourBookingService.js
// ==========================================

import { pool } from '../db/db.js';
import { randomBytes } from 'crypto';
import { sendBookingConfirmation, sendBookingCancellation } from './tourEmailService.js';

export const generateBookingReference = () => {
  return randomBytes(4).toString('hex').toUpperCase();
};

/**
 * Creates a booking using "on-demand" / "Just-in-Time" logic.
 * (For the OLD AvailabilityBookingWidget)
 * * REFACTORED FOR NEW STATE ARCHITECTURE (Origin 1)
 * This is the "Hostage" step.
 * Sets the initial state for the "Janitor" to monitor.
 */
export const createBooking = async (bookingData) => {
  const {
    tour_id,
    date,
    time,
    seats,
    total_amount,
    email,
    first_name,
    last_name,
    phone,
    special_requests
  } = bookingData;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Step 1: Get Tour Template (for default capacity)
    const tourResult = await client.query(
      'SELECT capacity FROM tours WHERE id = $1',
      [tour_id]
    );
    if (tourResult.rows.length === 0) {
      throw new Error('Tour not found');
    }
    const defaultCapacity = tourResult.rows[0].capacity;

    // Step 2: "Upsert" the Tour Instance
    const instanceResult = await client.query(
      `WITH upsert AS (
         INSERT INTO tour_instances (tour_id, date, "time", capacity, booked_seats, status)
         VALUES ($1, $2, $3, $4, 0, 'scheduled')
         ON CONFLICT (tour_id, date, "time") DO NOTHING
         RETURNING id
       )
       SELECT id FROM upsert
       UNION ALL
       SELECT id FROM tour_instances 
       WHERE tour_id = $1 AND date = $2 AND "time" = $3`,
      [tour_id, date, time, defaultCapacity]
    );

    const tourInstanceId = instanceResult.rows[0].id;

    // Step 3: Lock instance row and check availability
    const lockResult = await client.query(
      'SELECT * FROM tour_instances WHERE id = $1 FOR UPDATE',
      [tourInstanceId]
    );
    const instance = lockResult.rows[0];

    if (instance.status !== 'scheduled') {
      throw new Error('This tour is no longer scheduled');
    }
    
    const availableSeats = instance.capacity - instance.booked_seats;
    if (availableSeats < seats) {
      throw new Error('Not enough seats available');
    }

    // Step 4: Create or get customer
    const customerResult = await client.query(
      `INSERT INTO tour_customers (email, first_name, last_name, phone)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         phone = EXCLUDED.phone,
         updated_at = NOW()
       RETURNING id`,
      [email, first_name, last_name, phone]
    );

    const customerId = customerResult.rows[0].id;

    // Step 5: Generate unique booking reference
    let reference = generateBookingReference();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await client.query(
        'SELECT id FROM tour_bookings WHERE booking_reference = $1',
        [reference]
      );
      if (existing.rows.length === 0) break;
      reference = generateBookingReference();
      attempts++;
    }
    if (attempts === 5) {
      throw new Error('Failed to generate unique booking reference');
    }

    // Step 6: Create booking
    // --- [REFACTOR] ---
    // Sets the initial "hostage" state for an online booking (Origin 1)
    //
    const bookingResult = await client.query(
      `INSERT INTO tour_bookings 
       (booking_reference, tour_instance_id, customer_id, seats, total_amount, 
        special_requests, seat_status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'seat_pending', 'payment_stripe_pending')
       RETURNING *`,
      [
        reference,
        tourInstanceId,
        customerId,
        seats,
        total_amount,
        special_requests || null
      ]
    );

    const newBooking = bookingResult.rows[0];

    // Step 7: Update booked seats (The "Hostage" act)
    await client.query(
      `UPDATE tour_instances 
       SET booked_seats = booked_seats + $1, updated_at = NOW()
       WHERE id = $2`,
      [seats, tourInstanceId]
    );

    // Step 8: Create history record
    // --- [REFACTOR] ---
    await client.query(
      `INSERT INTO tour_booking_history (booking_id, previous_status, new_status, reason)
       VALUES ($1, NULL, 'seat_pending', 'Booking created')`,
      [newBooking.id]
    );

    await client.query('COMMIT');
    return newBooking;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Creates a complex booking from the new TicketBookingWidget.
 *
 * REFACTORED FOR NEW STATE ARCHITECTURE (Origin 1)
 * This is the "Hostage" step.
 * Sets the initial state for the "Janitor" to monitor.
 */
export const createTicketBooking = async (bookingData) => {
  const {
    tourId,
    date,
    time,
    totalSeats,
    totalAmount,
    customer, // { email, firstName, lastName, phone }
    tickets, // [{ ticket_id, quantity }]
    passengers, // [{ firstName, lastName, ticket_type }]
    customerNotes 
  } = bookingData;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Step 1: Get Tour Template (for default capacity)
    const tourResult = await client.query(
      'SELECT capacity FROM tours WHERE id = $1',
      [tourId]
    );
    if (tourResult.rows.length === 0) {
      throw new Error('Tour not found');
    }
    const defaultCapacity = tourResult.rows[0].capacity;

    // Step 2: "Upsert" the Tour Instance
    const instanceResult = await client.query(
      `WITH upsert AS (
         INSERT INTO tour_instances (tour_id, date, "time", capacity, booked_seats, status)
         VALUES ($1, $2, $3, $4, 0, 'scheduled')
         ON CONFLICT (tour_id, date, "time") DO NOTHING
         RETURNING id
       )
       SELECT id FROM upsert
       UNION ALL
       SELECT id FROM tour_instances 
       WHERE tour_id = $1 AND date = $2 AND "time" = $3`,
      [tourId, date, time, defaultCapacity]
    );

    const tourInstanceId = instanceResult.rows[0].id;

    // Step 3: Lock instance row and check availability
    const lockResult = await client.query(
      'SELECT * FROM tour_instances WHERE id = $1 FOR UPDATE',
      [tourInstanceId]
    );
    const instance = lockResult.rows[0];

    if (instance.status !== 'scheduled') {
      throw new Error('This tour is no longer scheduled');
    }
    
    const availableSeats = instance.capacity - instance.booked_seats;
    if (availableSeats < totalSeats) {
      throw new Error('Not enough seats available');
    }

    // Step 4: Create or get customer (using customer object)
    const customerResult = await client.query(
      `INSERT INTO tour_customers (email, first_name, last_name, phone)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         phone = EXCLUDED.phone,
         updated_at = NOW()
       RETURNING id`,
      [customer.email, customer.firstName, customer.lastName, customer.phone]
    );

    const customerId = customerResult.rows[0].id;

    // Step 5: Generate unique booking reference
    let reference = generateBookingReference();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await client.query(
        'SELECT id FROM tour_bookings WHERE booking_reference = $1',
        [reference]
      );
      if (existing.rows.length === 0) break;
      reference = generateBookingReference();
      attempts++;
    }
    if (attempts === 5) {
      throw new Error('Failed to generate unique booking reference');
    }

    // Step 6: Create booking
    // --- [REFACTOR] ---
    // Sets the initial "hostage" state for an online booking (Origin 1)
    //
    const bookingResult = await client.query(
      `INSERT INTO tour_bookings 
       (booking_reference, tour_instance_id, customer_id, seats, total_amount, 
        seat_status, payment_status, customer_notes)
       VALUES ($1, $2, $3, $4, $5, 'seat_pending', 'payment_stripe_pending', $6)
       RETURNING *`,
      [
        reference,
        tourInstanceId,
        customerId,
        totalSeats, 
        totalAmount,
        customerNotes || null 
      ]
    );

    const newBooking = bookingResult.rows[0];
    const newBookingId = newBooking.id;

    // Step 7: Update booked seats (The "Hostage" act)
    await client.query(
      `UPDATE tour_instances 
       SET booked_seats = booked_seats + $1, updated_at = NOW()
       WHERE id = $2`,
      [totalSeats, tourInstanceId]
    );

    // Step 8: Create history record
    // --- [REFACTOR] ---
    await client.query(
      `INSERT INTO tour_booking_history (booking_id, previous_status, new_status, reason)
       VALUES ($1, NULL, 'seat_pending', 'Booking created')`,
      [newBookingId]
    );

    // Step 9: Create passenger records
    for (const passenger of passengers) {
      await client.query(
        `INSERT INTO tour_booking_passengers (booking_id, first_name, last_name, ticket_type)
         VALUES ($1, $2, $3, $4)`,
        [newBookingId, passenger.firstName, passenger.lastName, passenger.ticket_type]
      );
    }

    await client.query('COMMIT');
    return newBooking; 

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const getBookingByReference = async (reference) => {
  const result = await pool.query(
    `SELECT 
      b.*,
      c.first_name,
      c.last_name,
      c.email,
      c.phone,
      ti.date,
      ti.time,
      t.name as tour_name,
      t.duration_minutes
    FROM tour_bookings b
    JOIN tour_customers c ON b.customer_id = c.id
    JOIN tour_instances ti ON b.tour_instance_id = ti.id
    JOIN tours t ON ti.tour_id = t.id
    WHERE b.booking_reference = $1`,
    [reference]
  );

  return result.rows[0];
};

/**
 * Updates a booking with the Stripe PaymentIntent ID.
 * This is called *after* createTicketBooking.
 */
export const updateBookingPaymentIntent = async (bookingId, paymentIntentId) => {
  const result = await pool.query(
    `UPDATE tour_bookings 
     SET payment_intent_id = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [paymentIntentId, bookingId]
  );
  return result.rows[0];
};

/**
 * Confirms a booking, typically after a successful Stripe payment webhook.
 * (Origin 1 - "Happy Path")
 *
 */
export const confirmBooking = async (bookingId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // --- [REFACTOR] ---
    // Updates state to the correct "confirmed" values.
    const result = await client.query(
      `UPDATE tour_bookings 
       SET seat_status = 'seat_confirmed', 
           payment_status = 'payment_stripe_success', 
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [bookingId]
    );

    // --- [REFACTOR] ---
    await client.query(
      `INSERT INTO tour_booking_history (booking_id, previous_status, new_status, reason)
       VALUES ($1, 'seat_pending', 'seat_confirmed', 'Payment successful')`,
      [bookingId]
    );

    await client.query('COMMIT');

    // Fetch full booking details for email
    const bookingDetails = await client.query(
      `SELECT 
        b.*,
        c.first_name, c.last_name, c.email, c.phone,
        ti.date, ti.time,
        t.name as tour_name, t.duration_minutes
      FROM tour_bookings b
      JOIN tour_customers c ON b.customer_id = c.id
      JOIN tour_instances ti ON b.tour_instance_id = ti.id
      JOIN tours t ON ti.tour_id = t.id
      WHERE b.id = $1`,
      [bookingId]
    );

    const booking = bookingDetails.rows[0];

    // Send confirmation email (don't await, let it run async)
    sendBookingConfirmation(
      booking,
      { first_name: booking.first_name, last_name: booking.last_name, email: booking.email },
      { date: booking.date, time: booking.time },
      { name: booking.tour_name, duration_minutes: booking.duration_minutes }
    ).catch(err => console.error('Failed to send confirmation email:', err));

    return result.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Cancels a booking, typically from a "Janitor" (webhook or cron).
 * (Origin 1 - "Abandoned/Failed Path")
 * This RELEASES "hostage" inventory.
 */
export const cancelBooking = async (bookingId, reason, adminId = null) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const bookingResult = await client.query(
      `SELECT b.*, c.first_name, c.last_name, c.email,
              ti.date, ti.time, t.name as tour_name
       FROM tour_bookings b
       JOIN tour_customers c ON b.customer_id = c.id
       JOIN tour_instances ti ON b.tour_instance_id = ti.id
       JOIN tours t ON ti.tour_id = t.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      throw new Error('Booking not found');
    }

    const booking = bookingResult.rows[0];
    
    // --- [REFACTOR] ---
    if (booking.seat_status === 'seat_cancelled') {
        client.release();
        return booking; // Already cancelled
    }

    // --- [REFACTOR] ---
    // A failed/abandoned online booking has no payment to refund.
    // Set payment_status to 'payment_none'.
    const result = await client.query(
      `UPDATE tour_bookings 
       SET seat_status = 'seat_cancelled', 
           payment_status = 'payment_none',
           cancelled_at = NOW(),
           cancellation_reason = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [reason, bookingId]
    );

    // --- [REFACTOR] ---
    // Release inventory if the seat was 'seat_pending' (hostage)
    // or 'seat_confirmed' (manual admin cancel)
    if (booking.seat_status === 'seat_confirmed' || booking.seat_status === 'seat_pending') {
      await client.query(
        `UPDATE tour_instances 
         SET booked_seats = booked_seats - $1, updated_at = NOW()
         WHERE id = $2`,
        [booking.seats, booking.tour_instance_id]
      );
    }

    // --- [REFACTOR] ---
    await client.query(
      `INSERT INTO tour_booking_history 
       (booking_id, previous_status, new_status, changed_by_admin, reason)
       VALUES ($1, $2, 'seat_cancelled', $3, $4)`,
      [bookingId, booking.seat_status, adminId, reason]
    );

    await client.query('COMMIT');

    // --- [REFACTOR] ---
    // Only send cancellation email if booking was confirmed (paid)
    // Janitor cancellations on 'seat_pending' should not email.
    if (booking.seat_status === 'seat_confirmed') {
      sendBookingCancellation(
        booking,
        { first_name: booking.first_name, last_name: booking.last_name, email: booking.email },
        { date: booking.date, time: booking.time },
        { name: booking.tour_name },
        reason
      ).catch(err => console.error('Failed to send cancellation email:', err));
    }

    return result.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const updateBookingPassengers = async (bookingId, passengers) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    await client.query(
      'DELETE FROM tour_booking_passengers WHERE booking_id = $1',
      [bookingId]
    );

    for (const passenger of passengers) {
      await client.query(
        `INSERT INTO tour_booking_passengers 
         (booking_id, first_name, last_name, ticket_type)
         VALUES ($1, $2, $3, $4)`,
        [
          bookingId,
          passenger.first_name,
          passenger.last_name,
          passenger.ticket_type
        ]
      );
    }

    await client.query('COMMIT');
    return { success: true, bookingId, passengerCount: passengers.length };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error in updateBookingPassengers transaction:`, error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Manually confirms a booking's SEAT.
 * This is an admin function. It's distinct from payment.
 * This function is now ambiguous with Origin 2/3 flows and
 * should be replaced by a dedicated admin service function
 * that creates a booking with 'seat_confirmed' from the start.
 * * For now, refactored to just update seat_status.
 */
export const manualConfirmBooking = async (bookingId, reason, adminId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    const currentBooking = await client.query(
      'SELECT seat_status FROM tour_bookings WHERE id = $1', 
      [bookingId]
    );
    // --- [REFACTOR] ---
    const previousStatus = currentBooking.rows[0]?.seat_status || 'unknown';

    // --- [REFACTOR] ---
    const result = await client.query(
      `UPDATE tour_bookings 
       SET seat_status = 'seat_confirmed', updated_at = NOW()
       WHERE id = $1 AND seat_status != 'seat_confirmed'
       RETURNING *`,
      [bookingId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Booking not found or already confirmed');
    }

    // --- [REFACTOR] ---
    await client.query(
      `INSERT INTO tour_booking_history 
       (booking_id, previous_status, new_status, changed_by_admin, reason)
       VALUES ($1, $2, 'seat_confirmed', $3, $4)`,
      [bookingId, previousStatus, adminId, reason]
    );

    await client.query('COMMIT');
    
    const bookingDetails = await client.query(
      `SELECT 
        b.*,
        c.first_name, c.last_name, c.email, c.phone,
        ti.date, ti.time,
        t.name as tour_name, t.duration_minutes
      FROM tour_bookings b
      JOIN tour_customers c ON b.customer_id = c.id
      JOIN tour_instances ti ON b.tour_instance_id = ti.id
      JOIN tours t ON ti.tour_id = t.id
      WHERE b.id = $1`,
      [bookingId]
    );
    const booking = bookingDetails.rows[0];

    sendBookingConfirmation(
      booking,
      { first_name: booking.first_name, last_name: booking.last_name, email: booking.email },
      { date: booking.date, time: booking.time },
      { name: booking.tour_name, duration_minutes: booking.duration_minutes }
    ).catch(err => console.error('Failed to send manual confirmation email:', err));

    return result.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Manually marks a booking as paid (e.g., cash).
 * (Origin 2 - Path A)
 *
 */
export const manualMarkAsPaid = async (bookingId, reason, adminId) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const currentBooking = await client.query(
      'SELECT payment_status FROM tour_bookings WHERE id = $1', 
      [bookingId]
    );
    const previousPaymentStatus = currentBooking.rows[0]?.payment_status || 'unknown';
    
    // --- [REFACTOR] ---
    // Updates payment status to 'payment_manual_success'.
    const result = await client.query(
      `UPDATE tour_bookings 
       SET payment_status = 'payment_manual_success', updated_at = NOW()
       WHERE id = $1 AND payment_status != 'payment_manual_success'
       RETURNING *`,
      [bookingId]
    );

    if (result.rows.length === 0) {
      throw new Error('Booking not found or already marked as manually paid');
    }
    
    // --- [REFACTOR] ---
    await client.query(
      `INSERT INTO tour_booking_history 
       (booking_id, previous_status, new_status, changed_by_admin, reason)
       VALUES ($1, $2, 'payment_manual_success', $3, $4)`,
      [bookingId, `payment: ${previousPaymentStatus}`, adminId, reason]
    );
    
    await client.query('COMMIT');
    return result.rows[0];
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * --- [NEW] ---
 * Admin action to resolve a Triage item with a manual refund (e.g., cash).
 *
 */
export const adminManualRefund = async ({ bookingId, reason, adminId }) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const bookingResult = await client.query(
      'SELECT * FROM tour_bookings WHERE id = $1 FOR UPDATE',
      [bookingId]
    );
    const booking = bookingResult.rows[0];

    if (!booking) throw new Error('Booking not found');
    if (booking.seat_status !== 'triage') {
      throw new Error('Booking is not in triage state.');
    }
    if (booking.payment_status !== 'payment_manual_success' && booking.payment_status !== 'refund_stripe_failed') {
      throw new Error(`Booking payment status (${booking.payment_status}) is not eligible for manual refund.`);
    }

    // Update states to resolved
    const result = await client.query(
      `UPDATE tour_bookings
       SET seat_status = 'seat_cancelled',
           payment_status = 'refund_manual_success',
           refund_amount = $1,
           refunded_at = NOW(),
           cancellation_reason = $2,
           admin_notes = COALESCE(admin_notes, '') || '\nManual refund processed by admin ${adminId}: ${reason}',
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [booking.total_amount, reason, bookingId]
    );

    // Release inventory
    await client.query(
      `UPDATE tour_instances
       SET booked_seats = booked_seats - $1, updated_at = NOW()
       WHERE id = $2`,
      [booking.seats, booking.tour_instance_id]
    );

    // Log both state changes
    await client.query(
      `INSERT INTO tour_booking_history
       (booking_id, previous_status, new_status, changed_by_admin, reason)
       VALUES ($1, 'triage', 'seat_cancelled', $2, $3)`,
      [bookingId, adminId, `Triage resolved: Manual Refund - ${reason}`]
    );
    await client.query(
      `INSERT INTO tour_booking_history
       (booking_id, previous_status, new_status, changed_by_admin, reason)
       VALUES ($1, $2, 'refund_manual_success', $3, $4)`,
      [bookingId, `payment: ${booking.payment_status}`, adminId, `Manual refund: ${reason}`]
    );
    
    await client.query('COMMIT');
    return result.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in adminManualRefund:', error);
    throw error;
  } finally {
    client.release();
  }
};