// server/src/services/tourBookingService.js
import { pool } from '../db/db.js';
import { randomBytes } from 'crypto';
import { sendBookingConfirmation, sendBookingCancellation } from './tourEmailService.js';

export const generateBookingReference = () => {
  return randomBytes(4).toString('hex').toUpperCase();
};

/**
 * Creates a booking using "on-demand" / "Just-in-Time" logic.
 * (For the OLD AvailabilityBookingWidget)
 * --- [FIX] ---
 * Now accepts paymentIntentId to satisfy DB constraints on INSERT
 */
export const createBooking = async (bookingData, paymentIntentId) => {
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
    // --- [FIX] ---
    // Inserts all required states at once to satisfy all constraints
    //
    const bookingResult = await client.query(
      `INSERT INTO tour_bookings 
       (booking_reference, tour_instance_id, customer_id, seats, total_amount, 
        special_requests, seat_status, payment_status, payment_intent_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'seat_pending', 'payment_stripe_pending', $7)
       RETURNING *`,
      [
        reference,
        tourInstanceId,
        customerId,
        seats,
        total_amount,
        special_requests || null,
        paymentIntentId // Pass in the PI_ID
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
    await client.query(
      `INSERT INTO tour_booking_history (booking_id, previous_status, new_status, reason)
       VALUES ($1, NULL, 'seat_pending', 'Booking created')`,
      [newBooking.id]
    );
    await client.query(
      `INSERT INTO tour_booking_history (booking_id, previous_status, new_status, reason)
       VALUES ($1, NULL, 'payment_stripe_pending', 'Booking created')`,
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
 * --- [FIX] ---
 * Now accepts paymentIntentId to satisfy DB constraints on INSERT
 */
export const createTicketBooking = async (bookingData, paymentIntentId) => {
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
    // --- [FIX] ---
    // Inserts all required states at once to satisfy all constraints
    //
    const bookingResult = await client.query(
      `INSERT INTO tour_bookings 
       (booking_reference, tour_instance_id, customer_id, seats, total_amount, 
        seat_status, payment_status, customer_notes, payment_intent_id)
       VALUES ($1, $2, $3, $4, $5, 'seat_pending', 'payment_stripe_pending', $6, $7)
       RETURNING *`,
      [
        reference,
        tourInstanceId,
        customerId,
        totalSeats, 
        totalAmount,
        customerNotes || null,
        paymentIntentId // Pass in the PI_ID
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
    await client.query(
      `INSERT INTO tour_booking_history (booking_id, previous_status, new_status, reason)
       VALUES ($1, NULL, 'seat_pending', 'Booking created')`,
      [newBookingId]
    );
    await client.query(
      `INSERT INTO tour_booking_history (booking_id, previous_status, new_status, reason)
       VALUES ($1, NULL, 'payment_stripe_pending', 'Booking created')`,
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
 * --- [REMOVED] ---
 * This function is now obsolete.
 * The booking is created with the payment_intent_id from the start.
 */
// export const updateBookingPaymentIntent = async (bookingId, paymentIntentId) => { ... }


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
    
    const booking = result.rows[0];
    if (!booking) {
      throw new Error(`Booking not found for ID: ${bookingId}`);
    }

    // --- [REFACTOR] ---
    // Log both state changes
    await client.query(
      `INSERT INTO tour_booking_history (booking_id, previous_status, new_status, reason)
       VALUES ($1, 'seat_pending', 'seat_confirmed', 'Payment successful')`,
      [bookingId]
    );
    await client.query(
      `INSERT INTO tour_booking_history (booking_id, previous_status, new_status, reason)
       VALUES ($1, 'payment_stripe_pending', 'payment_stripe_success', 'Payment successful')`,
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

    const fullBooking = bookingDetails.rows[0];

    // Send confirmation email (don't await, let it run async)
    sendBookingConfirmation(
      fullBooking,
      { first_name: fullBooking.first_name, last_name: fullBooking.last_name, email: fullBooking.email },
      { date: fullBooking.date, time: fullBooking.time },
      { name: fullBooking.tour_name, duration_minutes: fullBooking.duration_minutes }
    ).catch(err => console.error('Failed to send confirmation email:', err));

    return booking;

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
    // Log both state changes
    await client.query(
      `INSERT INTO tour_booking_history 
       (booking_id, previous_status, new_status, changed_by_admin, reason)
       VALUES ($1, $2, 'seat_cancelled', $3, $4)`,
      [bookingId, booking.seat_status, adminId, reason]
    );
    // Log the payment status change
    await client.query(
      `INSERT INTO tour_booking_history 
       (booking_id, previous_status, new_status, changed_by_admin, reason)
       VALUES ($1, $2, 'payment_none', $3, $4)`,
      [bookingId, booking.payment_status, adminId, reason]
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