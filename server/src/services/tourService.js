// ==========================================
// SERVICES: Tour Service
// server/src/services/tourService.js
// ==========================================

import { pool } from '../db/db.js';
// STUB: We need new email templates for this new workflow
import { sendTourCancellationTriageNotice, sendTourReinstatementNotice } from './tourEmailService.js';
// We still need processRefund, but it will be called from a new "Pending" page, NOT from here.
import { processRefund } from './tourStripeService.js';

export const createTour = async (tourData) => {
  const result = await pool.query(
    `INSERT INTO tours (name, description, duration_minutes, base_price, capacity, 
       booking_window_days, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      tourData.name,
      tourData.description,
      tourData.duration_minutes,
      tourData.base_price,
      tourData.capacity || 15,
      tourData.booking_window_days || 90,
      tourData.active !== undefined ? tourData.active : true
    ]
  );
  return result.rows[0];
};

export const getAllTours = async (activeOnly = false) => {
  const query = activeOnly 
    ? 'SELECT * FROM tours WHERE active = true ORDER BY name'
    : 'SELECT * FROM tours ORDER BY name';
  
  const result = await pool.query(query);
  return result.rows;
};

export const getTourById = async (id) => {
  const result = await pool.query(
    'SELECT * FROM tours WHERE id = $1',
    [id]
  );
  return result.rows[0];
};

export const updateTour = async (id, tourData) => {
  const result = await pool.query(
    `UPDATE tours 
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         duration_minutes = COALESCE($3, duration_minutes),
         base_price = COALESCE($4, base_price),
         capacity = COALESCE($5, capacity),
         active = COALESCE($6, active),
         booking_window_days = COALESCE($7, booking_window_days),
         updated_at = NOW()
     WHERE id = $8
     RETURNING *`,
    [
      tourData.name,
      tourData.description,
      tourData.duration_minutes,
      tourData.base_price,
      tourData.capacity,
      tourData.active,
      tourData.booking_window_days,
      id
    ]
  );
  return result.rows[0];
};

export const deleteTour = async (id) => {
  await pool.query('DELETE FROM tours WHERE id = $1', [id]);
};

export const createSchedule = async (tourId, scheduleConfig) => {
  const result = await pool.query(
    `INSERT INTO tour_schedules (tour_id, schedule_config, active)
     VALUES ($1, $2, true)
     RETURNING *`,
    [tourId, JSON.stringify(scheduleConfig)]
  );
  return result.rows[0];
};

export const updateSchedule = async (scheduleId, scheduleConfig) => {
  const result = await pool.query(
    `UPDATE tour_schedules
     SET schedule_config = $1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [JSON.stringify(scheduleConfig), scheduleId]
  );
  return result.rows[0];
};

export const getSchedulesByTourId = async (tourId) => {
  const result = await pool.query(
    'SELECT * FROM tour_schedules WHERE tour_id = $1 AND active = true',
    [tourId]
  );
  return result.rows;
};

export const generateTourInstances = async (scheduleId, startDate, endDate) => {
  // This function is for bulk-generation and is separate from our
  // "just-in-time" logic. We can leave it as-is.
  const scheduleResult = await pool.query(
    'SELECT * FROM tour_schedules WHERE id = $1',
    [scheduleId]
  );

  if (scheduleResult.rows.length === 0) {
    throw new Error('Schedule not found');
  }

  const schedule = scheduleResult.rows[0];
  const config = schedule.schedule_config;
  const tourResult = await pool.query('SELECT capacity FROM tours WHERE id = $1', [schedule.tour_id]);
  const capacity = tourResult.rows[0].capacity;

  const instances = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);

  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();
    const dateString = currentDate.toISOString().split('T')[0];

    if (config.days_of_week.includes(dayOfWeek) && 
        !config.exceptions.includes(dateString)) {
      
      for (const time of config.times) {
        try {
          const result = await pool.query(
            `INSERT INTO tour_instances (tour_id, schedule_id, date, time, capacity, status)
             VALUES ($1, $2, $3, $4, $5, 'scheduled')
             ON CONFLICT (tour_id, date, time) DO NOTHING
             RETURNING *`,
            [schedule.tour_id, scheduleId, dateString, time, capacity]
          );
          
          if (result.rows.length > 0) {
            instances.push(result.rows[0]);
          }
        } catch (error) {
          console.error(`Error creating instance for ${dateString} ${time}:`, error.message);
        }
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return instances;
};


// ========================================================================
// === CANCELLATION & RE-INSTATEMENT ARCHITECTURE ("TRIAGE" MODEL) ===
// ========================================================================
//
// DOCUMENTATION:
// Per our conversation, we are implementing a new "Operational Cancellation"
// model. This model separates the *operational* act of cancelling a tour
// (e.g., for a cyclone) from the *financial* act of refunding customers.
//
// 1. CANCELLATION:
//    - An admin cancels a tour (virtual or real).
//    - Step 1: The `tour_instances` row is created/updated to `status = 'cancelled'`.
//    - Step 2: All `tour_bookings` for that instance are updated to `status = 'pending_triage'`.
//    - Step 3: All affected customers are emailed a "Your tour is cancelled, we will
//      be in touch" notice (NOT a refund notice).
//
// 2. THE "PENDING" PAGE (Future):
//    - A new (future) admin page will be built to query all bookings with
//      `status = 'pending_triage'`.
//    - From this page, an admin can batch-refund (calling Stripe via `processRefund`)
//      or batch-transfer customers to a new tour.
//    - Refunding a booking moves its status from `pending_triage` to `cancelled`.
//    - Transferring a booking updates its `tour_instance_id` and sets its
//      status back to `confirmed`.
//
// 3. RE-INSTATEMENT:
//    - An admin re-instates a cancelled tour.
//    - Step 1: The `tour_instances` row is set back to `status = 'scheduled'`.
//    - Step 2: The system finds all `tour_bookings` for that instance *still* in
//      `pending_triage` and flips them back to `confirmed`.
//    - Step 3: These customers are emailed a "Your tour is back on!" notice.
//    - Any customer already refunded/transferred (status `cancelled` or `confirmed`
//      on another tour) is safely ignored.
//
// This architecture correctly handles the "cyclone" use case and is robust
// against accidental cancellations.
//
// ========================================================================

/**
 * NEW: Performs an "Operational Cancellation".
 * This robustly cancels a tour instance (virtual or real) and moves all
 * affected bookings into the 'pending_triage' queue.
 * This function DOES NOT process refunds.
 */
export const operationalCancelInstance = async ({ tourId, date, time, reason, adminId, capacity }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Step 1: Upsert the tour instance to 'cancelled'.
    // This finds an existing row OR creates a new one (for virtual tours)
    // and sets its status to 'cancelled', returning its ID.
    const instanceResult = await client.query(
      `INSERT INTO tour_instances 
        (tour_id, date, "time", capacity, booked_seats, status, 
         cancellation_reason, cancelled_at, cancelled_by, updated_at, created_at)
      VALUES 
        ($1, $2, $3, $4, 0, 'cancelled', $5, NOW(), $6, NOW(), NOW())
      ON CONFLICT (tour_id, date, "time") 
      DO UPDATE SET
        status = 'cancelled',
        cancellation_reason = $5,
        cancelled_at = NOW(),
        cancelled_by = $6,
        updated_at = NOW()
      WHERE
        tour_instances.status <> 'cancelled' -- Avoid redundant updates
      RETURNING id, tour_id`,
      [tourId, date, time, capacity, reason, adminId]
    );

    if (instanceResult.rows.length === 0) {
      // This can happen if the tour was *already* cancelled by someone else.
      // It's safe to just commit and return.
      await client.query('COMMIT');
      return { message: "Tour was already cancelled." };
    }
    
    const instanceId = instanceResult.rows[0].id;
    const effectiveTourId = instanceResult.rows[0].tour_id; // Get ID from upsert

    // Step 2: Move all 'confirmed' bookings for this instance to 'pending_triage'.
    const bookingsResult = await client.query(
      `UPDATE tour_bookings
       SET status = 'pending_triage',
           cancellation_reason = $1,
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE tour_instance_id = $2
         AND status = 'confirmed'
       RETURNING *`, // Return all affected bookings
      [reason, instanceId]
    );

    const affectedBookings = bookingsResult.rows;

    // Step 3: Log history and send (stubbed) emails for each affected booking.
    const tourNameResult = await client.query('SELECT name FROM tours WHERE id = $1', [effectiveTourId]);
    const tourName = tourNameResult.rows[0]?.name || 'Tour';
    
    for (const booking of affectedBookings) {
      // Add to history
      await client.query(
        `INSERT INTO tour_booking_history 
         (booking_id, previous_status, new_status, changed_by_admin, reason)
         VALUES ($1, 'confirmed', 'pending_triage', $2, $3)`,
        [booking.id, adminId, `Operational cancellation: ${reason}`]
      );

      // STUB: Send "triage" email (we will be in touch)
      // We need customer details for this.
      const custResult = await client.query('SELECT * FROM tour_customers WHERE id = $1', [booking.customer_id]);
      const customer = custResult.rows[0];
      
      if (customer) {
        sendTourCancellationTriageNotice(
          customer,
          booking,
          { name: tourName, date, time },
          reason
        ).catch(err => console.error(`Failed to send triage email to ${customer.email}:`, err));
      }
    }

    await client.query('COMMIT');

    return {
      cancelled_instance_id: instanceId,
      affected_bookings: affectedBookings.length,
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in operationalCancelInstance:', error);
    throw new Error(`Failed to cancel tour: ${error.message}`);
  } finally {
    client.release();
  }
};

/**
 * NEW: Re-instates a 'cancelled' tour instance.
 * This sets the tour back to 'scheduled' and automatically re-confirms
 * all bookings that are still in the 'pending_triage' queue.
 */
export const reInstateInstance = async ({ tourId, date, time, adminId }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Step 1: Set the tour instance back to 'scheduled'.
    const instanceResult = await client.query(
      `UPDATE tour_instances
       SET status = 'scheduled',
           cancellation_reason = NULL,
           cancelled_at = NULL,
           cancelled_by = NULL,
           updated_at = NOW()
       WHERE tour_id = $1
         AND date = $2
         AND "time" = $3
         AND status = 'cancelled'
       RETURNING id, tour_id`,
      [tourId, date, time]
    );

    if (instanceResult.rows.length === 0) {
      throw new Error('Tour instance not found or was not cancelled.');
    }
    
    const instanceId = instanceResult.rows[0].id;
    const effectiveTourId = instanceResult.rows[0].tour_id;

    // Step 2: Find all bookings *still in triage* and move them back to 'confirmed'.
    const bookingsResult = await client.query(
      `UPDATE tour_bookings
       SET status = 'confirmed',
           cancellation_reason = NULL,
           cancelled_at = NULL,
           updated_at = NOW()
       WHERE tour_instance_id = $1
         AND status = 'pending_triage'
       RETURNING *`, // Return all re-instated bookings
      [instanceId]
    );

    const reInstatedBookings = bookingsResult.rows;

    // Step 3: Log history and send (stubbed) "you're back on!" emails.
    const tourNameResult = await client.query('SELECT name FROM tours WHERE id = $1', [effectiveTourId]);
    const tourName = tourNameResult.rows[0]?.name || 'Tour';
    
    for (const booking of reInstatedBookings) {
      // Add to history
      await client.query(
        `INSERT INTO tour_booking_history 
         (booking_id, previous_status, new_status, changed_by_admin, reason)
         VALUES ($1, 'pending_triage', 'confirmed', $2, 'Tour re-instated by admin')`,
        [booking.id, adminId]
      );

      // STUB: Send "re-instatement" email
      const custResult = await client.query('SELECT * FROM tour_customers WHERE id = $1', [booking.customer_id]);
      const customer = custResult.rows[0];
      
      if (customer) {
        sendTourReinstatementNotice(
          customer,
          booking,
          { name: tourName, date, time }
        ).catch(err => console.error(`Failed to send re-instatement email to ${customer.email}:`, err));
      }
    }

    await client.query('COMMIT');

    return {
      reinstated_instance_id: instanceId,
      reinstated_bookings: reInstatedBookings.length,
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in reInstateInstance:', error);
    throw new Error(`Failed to re-instate tour: ${error.message}`);
  } finally {
    client.release();
  }
};