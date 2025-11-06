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
    const bookingResult = await client.query(
      `INSERT INTO tour_bookings 
       (booking_reference, tour_instance_id, customer_id, seats, total_amount, 
        special_requests, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'pending')
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

    // Step 7: Update booked seats
    await client.query(
      `UPDATE tour_instances 
       SET booked_seats = booked_seats + $1, updated_at = NOW()
       WHERE id = $2`,
      [seats, tourInstanceId]
    );

    // Step 8: Create history record
    await client.query(
      `INSERT INTO tour_booking_history (booking_id, previous_status, new_status, reason)
       VALUES ($1, NULL, 'pending', 'Booking created')`,
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
    passengers // [{ firstName, lastName, ticket_type }]
  } = bookingData;

  const ticketSummaryJson = JSON.stringify(tickets);

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
    const bookingResult = await client.query(
      `INSERT INTO tour_bookings 
       (booking_reference, tour_instance_id, customer_id, seats, total_amount, 
        status, payment_status)
       VALUES ($1, $2, $3, $4, $5, 'pending', 'pending')
       RETURNING *`,
      [
        reference,
        tourInstanceId,
        customerId,
        totalSeats, 
        totalAmount
      ]
    );

    const newBooking = bookingResult.rows[0];
    const newBookingId = newBooking.id;

    // Step 7: Update booked seats
    await client.query(
      `UPDATE tour_instances 
       SET booked_seats = booked_seats + $1, updated_at = NOW()
       WHERE id = $2`,
      [totalSeats, tourInstanceId]
    );

    // Step 8: Create history record
    await client.query(
      `INSERT INTO tour_booking_history (booking_id, previous_status, new_status, reason)
       VALUES ($1, NULL, 'pending', 'Booking created')`,
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
 * Confirms a booking, setting status='confirmed' and payment_status='paid'.
 * Used by the Stripe webhook upon successful payment.
 */
export const confirmBooking = async (bookingId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE tour_bookings 
       SET status = 'confirmed', payment_status = 'paid', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [bookingId]
    );

    await client.query(
      `INSERT INTO tour_booking_history (booking_id, previous_status, new_status, reason)
       VALUES ($1, 'pending', 'confirmed', 'Payment successful')`,
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
 * Cancels a booking, setting status='cancelled' and decrementing booked_seats
 * if the booking was 'pending' or 'confirmed'.
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
    
    // Do not cancel a booking that is already cancelled
    if (booking.status === 'cancelled') {
        client.release();
        return booking; // Return the already-cancelled booking
    }

    const result = await client.query(
      `UPDATE tour_bookings 
       SET status = 'cancelled', 
           cancelled_at = NOW(),
           cancellation_reason = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [reason, bookingId]
    );

    // Decrement seats if booking was 'confirmed' OR 'pending' (hostage)
    if (booking.status === 'confirmed' || booking.status === 'pending') {
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
       VALUES ($1, $2, 'cancelled', $3, $4)`,
      [bookingId, booking.status, adminId, reason]
    );

    await client.query('COMMIT');

    // Send cancellation email (only if it was 'confirmed')
    if (booking.status === 'confirmed') {
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

    // Step 1: Delete all existing passengers for this booking
    await client.query(
      'DELETE FROM tour_booking_passengers WHERE booking_id = $1',
      [bookingId]
    );

    // Step 2: Insert the new list of passengers
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
    throw error; // Re-throw to be caught by the controller
  } finally {
    client.release();
  }
};

// --- [NEW SERVICE FUNCTIONS] ---

/**
 * Manually confirms a booking. Sets status to 'confirmed'.
 * Does NOT affect payment_status.
 * Sends confirmation email.
 */
export const manualConfirmBooking = async (bookingId, reason, adminId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    const currentBooking = await client.query(
      'SELECT status FROM tour_bookings WHERE id = $1', 
      [bookingId]
    );
    const previousStatus = currentBooking.rows[0]?.status || 'unknown';

    const result = await client.query(
      `UPDATE tour_bookings 
       SET status = 'confirmed', updated_at = NOW()
       WHERE id = $1 AND status != 'confirmed'
       RETURNING *`,
      [bookingId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Booking not found or already confirmed');
    }

    await client.query(
      `INSERT INTO tour_booking_history 
       (booking_id, previous_status, new_status, changed_by_admin, reason)
       VALUES ($1, $2, 'confirmed', $3, $4)`,
      [bookingId, previousStatus, adminId, reason]
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
 * Manually marks a booking as paid. Sets payment_status to 'paid'.
 * Does NOT affect booking status.
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
    
    const result = await client.query(
      `UPDATE tour_bookings 
       SET payment_status = 'paid', updated_at = NOW()
       WHERE id = $1 AND payment_status != 'paid'
       RETURNING *`,
      [bookingId]
    );

    if (result.rows.length === 0) {
      throw new Error('Booking not found or already paid');
    }
    
    // We can reuse the history table for this
    await client.query(
      `INSERT INTO tour_booking_history 
       (booking_id, previous_status, new_status, changed_by_admin, reason)
       VALUES ($1, $2, 'paid', $3, $4)`,
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
// --- [END NEW SERVICE FUNCTIONS] ---