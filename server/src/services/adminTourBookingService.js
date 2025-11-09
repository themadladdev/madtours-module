// ==========================================
// server/src/services/adminTourBookingService.js
// ==========================================
import { pool } from '../db/db.js';
import { sendBookingConfirmation } from './tourEmailService.js';
import { generateBookingReference } from './tourBookingService.js'; // Import the generator
import { sanitizeInput } from '../utils/tourSanitize.js'; // Import sanitizer for admin notes

/**
 * --- [NEW] createManualBooking (Origin 2) ---
 * Moved from controller.
 * Creates a booking with 'seat_confirmed' and 'payment_manual_pending'.
 */
export const createManualBooking = async (sanitizedData, adminId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Step 1: Get Tour Template
    const tourResult = await client.query(
      'SELECT capacity FROM tours WHERE id = $1',
      [sanitizedData.tourId]
    );
    if (tourResult.rows.length === 0) throw new Error('Tour not found');
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
      [sanitizedData.tourId, sanitizedData.date, sanitizedData.time, defaultCapacity]
    );
    const tourInstanceId = instanceResult.rows[0].id;

    // Step 3: Lock instance row and check availability
    const lockResult = await client.query(
      'SELECT * FROM tour_instances WHERE id = $1 FOR UPDATE',
      [tourInstanceId]
    );
    const instance = lockResult.rows[0];

    if (instance.status !== 'scheduled') throw new Error('This tour is no longer scheduled');
    
    const availableSeats = instance.capacity - instance.booked_seats;
    if (availableSeats < sanitizedData.totalSeats) throw new Error('Not enough seats available');

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
      [sanitizedData.customer.email, sanitizedData.customer.firstName, sanitizedData.customer.lastName, sanitizedData.customer.phone]
    );
    const customerId = customerResult.rows[0].id;

    // Step 5: Generate unique booking reference
    const reference = generateBookingReference(); 

    // Step 6: Create booking with Origin 2 states
    const bookingResult = await client.query(
      `INSERT INTO tour_bookings 
       (booking_reference, tour_instance_id, customer_id, seats, total_amount, 
        seat_status, payment_status, customer_notes, admin_notes)
       VALUES ($1, $2, $3, $4, $5, 'seat_confirmed', 'payment_manual_pending', $6, $7)
       RETURNING *`,
      [
        reference,
        tourInstanceId,
        customerId,
        sanitizedData.totalSeats, 
        sanitizedData.totalAmount,
        sanitizedData.customerNotes || null,
        `Created by admin ${adminId}`
      ]
    );
    const newBooking = bookingResult.rows[0];
    const newBookingId = newBooking.id;

    // Step 7: Update booked seats
    await client.query(
      `UPDATE tour_instances 
       SET booked_seats = booked_seats + $1, updated_at = NOW()
       WHERE id = $2`,
      [sanitizedData.totalSeats, tourInstanceId]
    );

    // Step 8: Create history record
    await client.query(
      `INSERT INTO tour_booking_history (booking_id, new_status, changed_by_admin, reason)
       VALUES ($1, 'seat_confirmed', $2, 'Manual booking created')`,
      [newBookingId, adminId]
    );

    // Step 9: Create passenger records
    for (const passenger of sanitizedData.passengers) {
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

/**
 * --- [NEW] createFocBooking (Origin 3) ---
 * Moved from controller.
 * Creates a booking with 'seat_confirmed' and 'payment_foc'.
 */
export const createFocBooking = async (sanitizedData, adminNotes, adminId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Step 1: Get Tour Template
    const tourResult = await client.query('SELECT capacity FROM tours WHERE id = $1', [sanitizedData.tourId]);
    if (tourResult.rows.length === 0) throw new Error('Tour not found');
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
       SELECT id FROM tour_instances WHERE tour_id = $1 AND date = $2 AND "time" = $3`,
      [sanitizedData.tourId, sanitizedData.date, sanitizedData.time, defaultCapacity]
    );
    const tourInstanceId = instanceResult.rows[0].id;

    // Step 3: Lock instance row and check availability
    const lockResult = await client.query('SELECT * FROM tour_instances WHERE id = $1 FOR UPDATE', [tourInstanceId]);
    const instance = lockResult.rows[0];
    if (instance.status !== 'scheduled') throw new Error('This tour is no longer scheduled');
    const availableSeats = instance.capacity - instance.booked_seats;
    if (availableSeats < sanitizedData.totalSeats) throw new Error('Not enough seats available');

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
      [sanitizedData.customer.email, sanitizedData.customer.firstName, sanitizedData.customer.lastName, sanitizedData.customer.phone]
    );
    const customerId = customerResult.rows[0].id;

    // Step 5: Generate unique booking reference
    const reference = generateBookingReference();

    // Step 6: Create booking with Origin 3 states
    const bookingResult = await client.query(
      `INSERT INTO tour_bookings 
       (booking_reference, tour_instance_id, customer_id, seats, total_amount, 
        seat_status, payment_status, customer_notes, admin_notes)
       VALUES ($1, $2, $3, $4, 0.00, 'seat_confirmed', 'payment_foc', $5, $6)
       RETURNING *`,
      [
        reference,
        tourInstanceId,
        customerId,
        sanitizedData.totalSeats,
        sanitizedData.customerNotes || null,
        `FOC Created by admin ${adminId}: ${sanitizeInput(adminNotes) || 'Complimentary'}`
      ]
    );
    const newBooking = bookingResult.rows[0];
    const newBookingId = newBooking.id;

    // Step 7: Update booked seats
    await client.query(
      `UPDATE tour_instances SET booked_seats = booked_seats + $1, updated_at = NOW() WHERE id = $2`,
      [sanitizedData.totalSeats, tourInstanceId]
    );

    // Step 8: Create history record
    await client.query(
      `INSERT INTO tour_booking_history (booking_id, new_status, changed_by_admin, reason)
       VALUES ($1, 'seat_confirmed', $2, 'FOC booking created')`,
      [newBookingId, adminId]
    );

    // Step 9: Create passenger records
    for (const passenger of sanitizedData.passengers) {
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

/**
 * Manually confirms a booking's SEAT.
 * This is an admin function.
 */
export const manualConfirmBooking = async (bookingId, reason, adminId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    const currentBooking = await client.query(
      'SELECT seat_status FROM tour_bookings WHERE id = $1', 
      [bookingId]
    );
    const previousStatus = currentBooking.rows[0]?.seat_status || 'unknown';

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