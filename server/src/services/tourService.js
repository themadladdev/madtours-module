// ==========================================
// SERVICES: Tour Service
// server/src/services/tourService.js
// ==========================================

import { pool } from '../db/db.js';
import { sendTourCancellationNotice } from './tourEmailService.js';
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
      tourData.booking_window_days || 90, // Added
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
         booking_window_days = COALESCE($7, booking_window_days), -- Added
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
      tourData.booking_window_days, // Added
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

// === NEW FUNCTION ===
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
// === END NEW FUNCTION ===

export const getSchedulesByTourId = async (tourId) => {
  const result = await pool.query(
    'SELECT * FROM tour_schedules WHERE tour_id = $1 AND active = true',
    [tourId]
  );
  return result.rows;
};

export const generateTourInstances = async (scheduleId, startDate, endDate) => {
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

    // Check if this day is in the schedule and not in exceptions
    if (config.days_of_week.includes(dayOfWeek) && 
        !config.exceptions.includes(dateString)) {
      
      // Create instance for each time slot
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

export const cancelTourInstanceWithRefunds = async (instanceId, reason, adminId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Cancel the tour instance
    await client.query(
      `UPDATE tour_instances 
       SET status = 'cancelled',
           cancellation_reason = $1,
           cancelled_at = NOW(),
           cancelled_by = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [reason, adminId, instanceId]
    );

    // Get all confirmed bookings for this instance
    const bookingsResult = await client.query(
      `SELECT b.*, c.first_name, c.last_name, c.email,
              ti.date, ti.time, t.name as tour_name
       FROM tour_bookings b
       JOIN tour_customers c ON b.customer_id = c.id
       JOIN tour_instances ti ON b.tour_instance_id = ti.id
       JOIN tours t ON ti.tour_id = t.id
       WHERE b.tour_instance_id = $1 
         AND b.status = 'confirmed'
         AND b.payment_status = 'paid'`,
      [instanceId]
    );

    const bookings = bookingsResult.rows;

    // Process refunds and send emails for each booking
    for (const booking of bookings) {
      try {
        // Process refund through Stripe
        await processRefund(booking.id, null, reason);

        // Cancel booking
        await client.query(
          `UPDATE tour_bookings 
           SET status = 'cancelled',
               cancelled_at = NOW(),
               cancellation_reason = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [reason, booking.id]
        );

        // Add to history
        await client.query(
          `INSERT INTO tour_booking_history 
           (booking_id, previous_status, new_status, changed_by_admin, reason)
           VALUES ($1, $2, 'cancelled', $3, $4)`,
          [booking.id, booking.status, adminId, `Tour cancelled: ${reason}`]
        );

        // Send email notification
        sendTourCancellationNotice(
          booking,
          { first_name: booking.first_name, last_name: booking.last_name, email: booking.email },
          { date: booking.date, time: booking.time },
          { name: booking.tour_name },
          reason
        ).catch(err => console.error(`Failed to send tour cancellation email to ${booking.email}:`, err));

      } catch (error) {
        console.error(`Error processing refund for booking ${booking.id}:`, error);
        // Continue with other bookings even if one fails
      }
    }

    await client.query('COMMIT');

    return {
      cancelled_instance: instanceId,
      affected_bookings: bookings.length,
      refunds_processed: bookings.length
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};