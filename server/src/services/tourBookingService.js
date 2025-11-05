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

// --- NEW: Function for the TicketBookingWidget ---
/**
 * Creates a complex booking from the new TicketBookingWidget.
 * This function will:
 * 1. Find/Create the tour_instance.
 * 2. Lock and check availability.
 * 3. Create the tour_customer.
 * 4. Create the main tour_bookings record.
 * 5. Create all tour_booking_passengers records.
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

  // --- DEBUG [3/3] ---
  console.log('--- DEBUG [SERVER SERVICE]: createTicketBooking received passengers ---');
  console.log(passengers);
  // --- END DEBUG ---
  
  // We will add the `ticket_summary` column to this INSERT
  // once we've added it to the table. For now, we skip it.
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
    // NOTE: We are skipping special_requests and ticket_summary for now
    // We will add ticket_summary once the column is created
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
        totalSeats, // Use totalSeats
        totalAmount // Use totalAmount
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

    // --- NEW: Step 9: Create passenger records ---
    // --- DEBUG [3/3] ---
    console.log(`--- DEBUG [SERVER SERVICE]: Looping ${passengers.length} passengers ---`);
    // --- END DEBUG ---
    for (const passenger of passengers) {
      // --- DEBUG [3/3] ---
      console.log('--- DEBUG [SERVER SERVICE]: Inserting passenger ---', passenger.firstName);
      // --- END DEBUG ---
      await client.query(
        `INSERT INTO tour_booking_passengers (booking_id, first_name, last_name, ticket_type)
         VALUES ($1, $2, $3, $4)`,
        [newBookingId, passenger.firstName, passenger.lastName, passenger.ticket_type]
      );
    }
    // --- END NEW STEP ---

    await client.query('COMMIT');
    return newBooking; // Return the main booking object

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
// --- END NEW FUNCTION ---

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

    // Only update seats if the booking was confirmed
    if (booking.status === 'confirmed') {
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

    // Send cancellation email
    sendBookingCancellation(
      booking,
      { first_name: booking.first_name, last_name: booking.last_name, email: booking.email },
      { date: booking.date, time: booking.time },
      { name: booking.tour_name },
      reason
    ).catch(err => console.error('Failed to send cancellation email:', err));

    return result.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};