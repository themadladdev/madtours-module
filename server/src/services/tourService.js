// ==========================================
// SERVICES: Tour Service
// server/src/services/tourService.js
// ==========================================

import { pool } from '../db/db.js';
import { sendTourCancellationTriageNotice, sendTourReinstatementNotice } from './tourEmailService.js';
// --- [REFACTOR] Import Stripe and booking service for new Triage logic ---
import { stripe } from './tourStripeService.js';
import { cancelBooking } from './tourBookingService.js';

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

/**
 * --- [REFACTORED] ---
 * Implements the new Triage Model logic.
 * 1. Moves 'seat_confirmed' bookings to 'triage'.
 * 2. Auto-cancels 'seat_pending' bookings and their Payment Intents.
 *
 */
export const operationalCancelInstance = async ({ tourId, date, time, reason, adminId, capacity }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Step 1: Upsert the tour instance to 'cancelled'.
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
        tour_instances.status <> 'cancelled'
      RETURNING id, tour_id`,
      [tourId, date, time, capacity, reason, adminId]
    );

    if (instanceResult.rows.length === 0) {
      await client.query('COMMIT');
      return { message: "Tour was already cancelled." };
    }
    
    const instanceId = instanceResult.rows[0].id;
    const effectiveTourId = instanceResult.rows[0].tour_id;

    // --- [REFACTOR] Step 2: Auto-cancel 'seat_pending' bookings ---
    //
    const pendingBookingsResult = await client.query(
      `UPDATE tour_bookings
       SET seat_status = 'seat_cancelled',
           payment_status = 'payment_none',
           cancellation_reason = $1,
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE tour_instance_id = $2
         AND seat_status = 'seat_pending'
       RETURNING id, payment_intent_id`,
      [`Tour operationally cancelled: ${reason}`, instanceId]
    );

    const autoCancelledBookings = pendingBookingsResult.rows;
    
    // --- [NEW] Step 2b: Cancel Stripe PaymentIntents for pending bookings ---
    for (const booking of autoCancelledBookings) {
      if (booking.payment_intent_id) {
        try {
          await stripe.paymentIntents.cancel(booking.payment_intent_id);
        } catch (stripeErr) {
          console.error(`[Triage] Failed to cancel Stripe PI ${booking.payment_intent_id} for booking ${booking.id}:`, stripeErr.message);
          // Don't stop the transaction, just log the error
        }
      }
      // Log history
      await client.query(
        `INSERT INTO tour_booking_history 
         (booking_id, previous_status, new_status, changed_by_admin, reason)
         VALUES ($1, 'seat_pending', 'seat_cancelled', $2, $3)`,
        [booking.id, adminId, `Tour auto-cancelled: ${reason}`]
      );
    }

    // --- [REFACTOR] Step 3: Move 'seat_confirmed' bookings to 'triage' ---
    //
    const bookingsResult = await client.query(
      `UPDATE tour_bookings
       SET seat_status = 'triage',
           cancellation_reason = $1,
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE tour_instance_id = $2
         AND seat_status = 'seat_confirmed'
       RETURNING *`, 
      [reason, instanceId]
    );

    const affectedBookings = bookingsResult.rows;

    // Step 4: Log history and send emails for TRIAGED bookings.
    const tourNameResult = await client.query('SELECT name FROM tours WHERE id = $1', [effectiveTourId]);
    const tourName = tourNameResult.rows[0]?.name || 'Tour';
    
    for (const booking of affectedBookings) {
      // Add to history
      // --- [REFACTOR] ---
      await client.query(
        `INSERT INTO tour_booking_history 
         (booking_id, previous_status, new_status, changed_by_admin, reason)
         VALUES ($1, 'seat_confirmed', 'triage', $2, $3)`,
        [booking.id, adminId, `Operational cancellation: ${reason}`]
      );

      // STUB: Send "triage" email (we will be in touch)
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
      moved_to_triage: affectedBookings.length,
      auto_cancelled_pending: autoCancelledBookings.length,
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
 * --- [REFACTORED] ---
 * Implements the new Triage Model logic.
 * Moves 'triage' bookings back to 'seat_confirmed'.
 *
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

    // --- [REFACTOR] Step 2: Find 'triage' bookings and move back to 'seat_confirmed' ---
    //
    const bookingsResult = await client.query(
      `UPDATE tour_bookings
       SET seat_status = 'seat_confirmed',
           cancellation_reason = NULL,
           cancelled_at = NULL,
           updated_at = NOW()
       WHERE tour_instance_id = $1
         AND seat_status = 'triage'
       RETURNING *`, 
      [instanceId]
    );

    const reInstatedBookings = bookingsResult.rows;

    // Step 3: Log history and send "you're back on!" emails.
    const tourNameResult = await client.query('SELECT name FROM tours WHERE id = $1', [effectiveTourId]);
    const tourName = tourNameResult.rows[0]?.name || 'Tour';
    
    for (const booking of reInstatedBookings) {
      // Add to history
      // --- [REFACTOR] ---
      await client.query(
        `INSERT INTO tour_booking_history 
         (booking_id, previous_status, new_status, changed_by_admin, reason)
         VALUES ($1, 'triage', 'seat_confirmed', $2, 'Tour re-instated by admin')`,
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

/**
 * --- [REFACTORED] ---
 * Implements the new Triage Model logic inside the batch loop.
 * 1. Moves 'seat_confirmed' bookings to 'triage'.
 * 2. Auto-cancels 'seat_pending' bookings and their Payment Intents.
 *
 */
export const batchCancelBlackout = async ({ tourId, startDate, endDate, reason, adminId }) => {
  console.log(`[Service] Starting batch-cancel transaction for Tour ${tourId}...`);
  const client = await pool.connect();
  let updated_schedule_id = null;
  let cancelled_instances_count = 0;
  let affected_bookings_count = 0;
  let auto_cancelled_count = 0; // --- [NEW] ---

  try {
    await client.query('BEGIN');

    // --- Step 1: Get Tour Rules (Schedule and default capacity) ---
    const tourRulesResult = await client.query(
      `SELECT 
         t.capacity AS default_capacity,
         ts.id AS schedule_id,
         ts.schedule_config
       FROM tours t
       JOIN tour_schedules ts ON t.id = ts.tour_id
       WHERE t.id = $1 AND ts.active = true
       LIMIT 1`,
      [tourId]
    );

    if (tourRulesResult.rows.length === 0) {
      throw new Error(`No active tour or schedule found for Tour ID ${tourId}.`);
    }

    const { default_capacity, schedule_id, schedule_config } = tourRulesResult.rows[0];
    
    // --- [REFACTOR] Handle potentially missing 'schedule' key ---
    const scheduleRules = schedule_config && schedule_config.schedule ? schedule_config.schedule : null;

    if (!scheduleRules || !scheduleRules.times || !scheduleRules.days_of_week) {
      // This is a data-integrity issue, but let's try to proceed by
      // only updating the schedule config, as no virtual tours can be generated.
       console.warn(`Tour ${tourId} has invalid or missing schedule config. Proceeding to update blackout range only.`);
    }

    // --- Step 2: Update the Tour Schedule Config (Add Blackout Range) ---
    let newConfig = { ...schedule_config };
    if (!newConfig.schedule) newConfig.schedule = {};
    if (!newConfig.schedule.blackout_ranges) newConfig.schedule.blackout_ranges = [];
    
    newConfig.schedule.blackout_ranges.push({ from: startDate, to: endDate, reason: reason });
    
    await client.query(
      `UPDATE tour_schedules SET schedule_config = $1, updated_at = NOW()
       WHERE id = $2`,
      [newConfig, schedule_id]
    );
    updated_schedule_id = schedule_id;
    console.log(`[Service] Updated schedule ${schedule_id} with new blackout range.`);

    // --- Step 3: Generate list of all virtual tours to be cancelled ---
    const toursToCancel = [];
    // Only proceed if we have rules to check against
    if (scheduleRules && scheduleRules.times && scheduleRules.days_of_week) {
      const start = new Date(`${startDate}T00:00:00Z`); // Explicitly UTC
      const end = new Date(`${endDate}T00:00:00Z`);   // Explicitly UTC

      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const dayOfWeek = d.getUTCDay(); // 0 = Sunday
        const dateString = d.toISOString().split('T')[0]; // YYYY-MM-DD

        // Check if this day is a scheduled day
        if (scheduleRules.days_of_week.includes(dayOfWeek)) {
          // Add all times for this day
          for (const time of scheduleRules.times) {
            toursToCancel.push({
              date: dateString,
              time: `${time}:00`
            });
          }
        }
      }
    }
    
    if (toursToCancel.length === 0) {
       console.log(`[Service] No virtual tours scheduled in this range. Only updating schedule.`);
    }

    // --- Step 4: Call operationalCancelInstance for EACH virtual tour ---
    console.log(`[Service] Found ${toursToCancel.length} virtual tours to cancel...`);
    
    const tourNameResult = await client.query('SELECT name FROM tours WHERE id = $1', [tourId]);
    const tourName = tourNameResult.rows[0]?.name || 'Tour';
        
    for (const tour of toursToCancel) {
      const { date, time } = tour;
      
      // --- DUPLICATED LOGIC from operationalCancelInstance (as per file comments) ---
      
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
          tour_instances.status <> 'cancelled'
        RETURNING id`,
        [tourId, date, time, default_capacity, reason, adminId]
      );
      
      if (instanceResult.rows.length > 0) {
        cancelled_instances_count++;
        const instanceId = instanceResult.rows[0].id;
        
        // --- [REFACTOR] Step 4a: Auto-cancel 'seat_pending' bookings ---
        const pendingBookingsResult = await client.query(
          `UPDATE tour_bookings
           SET seat_status = 'seat_cancelled',
               payment_status = 'payment_none',
               cancellation_reason = $1,
               cancelled_at = NOW(),
               updated_at = NOW()
           WHERE tour_instance_id = $2
             AND seat_status = 'seat_pending'
           RETURNING id, payment_intent_id`,
          [`Tour operationally cancelled: ${reason}`, instanceId]
        );

        const autoCancelledBookings = pendingBookingsResult.rows;
        auto_cancelled_count += autoCancelledBookings.length;

        // --- [NEW] Step 4b: Cancel Stripe PIs ---
        for (const booking of autoCancelledBookings) {
          if (booking.payment_intent_id) {
            try {
              await stripe.paymentIntents.cancel(booking.payment_intent_id);
            } catch (stripeErr) {
              console.error(`[BatchTriage] Failed to cancel Stripe PI ${booking.payment_intent_id} for booking ${booking.id}:`, stripeErr.message);
            }
          }
          await client.query(
            `INSERT INTO tour_booking_history 
             (booking_id, previous_status, new_status, changed_by_admin, reason)
             VALUES ($1, 'seat_pending', 'seat_cancelled', $2, $3)`,
            [booking.id, adminId, `Batch cancellation: ${reason}`]
          );
        }

        // --- [REFACTOR] Step 4c: Move 'seat_confirmed' bookings to 'triage' ---
        const bookingsResult = await client.query(
          `UPDATE tour_bookings
           SET seat_status = 'triage',
               cancellation_reason = $1,
               cancelled_at = NOW(),
               updated_at = NOW()
           WHERE tour_instance_id = $2
             AND seat_status = 'seat_confirmed'
           RETURNING *`,
          [reason, instanceId]
        );

        const affectedBookings = bookingsResult.rows;
        affected_bookings_count += affectedBookings.length;
        
        // --- [REFACTOR] Step 4d: Log history and send emails for TRIAGED bookings ---
        for (const booking of affectedBookings) {
          await client.query(
            `INSERT INTO tour_booking_history 
             (booking_id, previous_status, new_status, changed_by_admin, reason)
             VALUES ($1, 'seat_confirmed', 'triage', $2, $3)`,
            [booking.id, adminId, `Batch cancellation: ${reason}`]
          );

          const custResult = await client.query('SELECT * FROM tour_customers WHERE id = $1', [booking.customer_id]);
          const customer = custResult.rows[0];
          
          if (customer) {
            sendTourCancellationTriageNotice(
              customer,
              booking,
              { name: tourName, date, time },
              reason
            ).catch(err => console.error(`[Service] Failed to send triage email to ${customer.email}:`, err));
          }
        }
      }
    }

    await client.query('COMMIT');
    console.log(`[Service] Batch-cancel transaction committed.`);

    return {
      updated_schedule_id: updated_schedule_id,
      cancelled_instances: cancelled_instances_count,
      affected_bookings: affected_bookings_count,
      auto_cancelled_pending: auto_cancelled_count, // --- [NEW] ---
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Service] Error in batchCancelBlackout:', error);
    throw new Error(`Failed to apply blackout: ${error.message}`);
  } finally {
    client.release();
  }
};
// === END NEW FUNCTION ===

// ========================================================================
// === NEW HELPER FOR PRICING EXCEPTIONS ===
// ========================================================================

/**
 * Finds an existing tour_instance or creates a new "scheduled" one.
 * This is a helper function to ensure an "exception" row exists
 * in tour_instances before we can attach a price exception to it.
 * This function is designed to be called within another transaction.
 * @param {object} client - The active database client from a transaction.
 * @param {object} data - { tourId, date, time, defaultCapacity }
 *Returns {Promise<number>} The ID of the found or created tour instance.
 */
export const findOrCreateInstance = async (client, { tourId, date, time, defaultCapacity }) => {
  // We use ON CONFLICT... DO UPDATE to get the ID back whether it's an
  // INSERT or a (no-op) UPDATE.
  const result = await client.query(
    `INSERT INTO tour_instances (tour_id, date, "time", capacity, status)
     VALUES ($1, $2, $3, $4, 'scheduled')
     ON CONFLICT (tour_id, date, "time")
     DO UPDATE SET
       -- This is a no-op update that allows us to get the ID
       -- of the conflicting row. We just "update" capacity to its
       -- existing value, or the default if it was 0.
       capacity = GREATEST(tour_instances.capacity, $4)
     RETURNING id`,
    [tourId, date, time, defaultCapacity]
  );

  if (result.rows.length === 0) {
    // This should not be possible with ON CONFLICT... RETURNING
    throw new Error('Failed to find or create tour instance.');
  }
  
  return result.rows[0];
};