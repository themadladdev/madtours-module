// ==========================================
// UPDATED FILE
// server/src/utils/tourReminderCron.js
// ==========================================

import cron from 'node-cron';
import { pool } from '../db/db.js';
import { sendBookingReminder } from '../services/tourEmailService.js';

// --- NEW: Imports for Abandoned Cart Janitor ---
import { stripe } from '../services/tourStripeService.js';
import { cancelBooking } from '../services/tourBookingService.js';

// --- 1. Existing Reminder Job (Refactored) ---

export const startReminderCron = () => {
  // Run every day at 9 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('🔔 Running reminder email job...');

    try {
      // Get bookings for tomorrow that haven't been reminded
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDate = tomorrow.toISOString().split('T')[0];

      // --- [REFACTOR] ---
      // Updated query to use `seat_status = 'seat_confirmed'`
      //
      const result = await pool.query(
        `SELECT 
          b.id, b.booking_reference, b.seats,
          c.first_name, c.last_name, c.email,
          ti.date, ti.time,
          t.name as tour_name, t.duration_minutes
        FROM tour_bookings b 
        JOIN tour_customers c ON b.customer_id = c.id
        JOIN tour_instances ti ON b.tour_instance_id = ti.id
        JOIN tours t ON ti.tour_id = t.id
        WHERE ti.date = $1
          AND b.seat_status = 'seat_confirmed'
          AND b.reminder_sent = false`,
        [tomorrowDate]
      );

      console.log(`📧 Sending ${result.rows.length} reminder emails...`);

      for (const booking of result.rows) {
        try {
          await sendBookingReminder(
            booking,
            { first_name: booking.first_name, last_name: booking.last_name, email: booking.email },
            { date: booking.date, time: booking.time },
            { name: booking.tour_name, duration_minutes: booking.duration_minutes }
          );

          // This query is correct
          await pool.query(
            'UPDATE tour_bookings SET reminder_sent = true WHERE id = $1',
            [booking.id]
          );
        } catch (error) {
          console.error(`Failed to send reminder for booking ${booking.id}:`, error);
        }
      }

      console.log('✅ Reminder email job completed');

    } catch (error) {
      console.error('❌ Error in reminder cron job:', error);
    }
  });

  console.log('✅ Reminder cron job scheduled (daily at 9 AM)');
};


// --- 2. NEW: Abandoned Cart "Janitor" Job (Refactored) ---

// Define the timeout (e.g., 60 minutes)
const PENDING_TIMEOUT_MINUTES = 60;

export const startAbandonedCartCron = () => {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    console.log('🧹 Running abandoned cart "Janitor" job...');
    
    const timeout = new Date(Date.now() - PENDING_TIMEOUT_MINUTES * 60 * 1000);

    let client;
    try {
      client = await pool.connect();
      
      // --- [REFACTOR] ---
      // Updated query to target the *specific* "hostage" state:
      // 'seat_pending' AND 'payment_stripe_pending'
      //
      const { rows: abandonedBookings } = await client.query(
        `SELECT id, payment_intent_id 
         FROM tour_bookings 
         WHERE seat_status = 'seat_pending'
           AND payment_status = 'payment_stripe_pending' 
           AND created_at < $1`,
        [timeout]
      );

      if (abandonedBookings.length === 0) {
        console.log('🧹 No abandoned carts found.');
        client.release();
        return;
      }

      console.log(`Found ${abandonedBookings.length} abandoned cart(s). Cleaning up...`);

      for (const booking of abandonedBookings) {
        try {
          // 1. Cancel the PaymentIntent with Stripe
          if (booking.payment_intent_id) {
            await stripe.paymentIntents.cancel(booking.payment_intent_id);
          }

          // 2. Call our local cancelBooking service
          // This will set seat_status='seat_cancelled', payment_status='payment_none',
          // and release the inventory.
          await cancelBooking(booking.id, 'Abandoned cart timeout (Janitor)');
          
          console.log(`- Cleaned up booking ${booking.id}`);

        } catch (err) {
          // Log error but continue to the next booking
          console.error(`- Failed to clean up booking ${booking.id}:`, err.message);
          
          if (err.code === 'payment_intent_unexpected_state') {
             console.warn(`  > Stripe PI ${booking.payment_intent_id} was in an unexpected state. Manual review may be needed.`);
          }
        }
      }
      
      console.log('✅ Abandoned cart job completed.');

    } catch (err) {
      console.error('❌ Error in abandoned cart cron job:', err);
    } finally {
      if (client) {
        client.release();
      }
    }
  });

  console.log('✅ Abandoned cart "Janitor" scheduled (every 15 mins)');
};

// --- [NEW] 3. Daily Counter Reconciliation "Accountant" Job ---

export const startReconciliationCron = () => {
  // Run once per day at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('🧾 Running counter reconciliation "Accountant" job...');
    
    let client;
    try {
      client = await pool.connect();
      
      // 1. Create a Common Table Expression (CTE) that calculates the
      //    *correct* booked_seats sum for EVERY instance.
      //    We count all seats that are NOT 'seat_cancelled'.
      const { rows: updatedRows } = await client.query(`
        WITH CorrectCounts AS (
          SELECT
            tour_instance_id,
            COALESCE(SUM(seats), 0) AS actual_booked_seats
          FROM tour_bookings
          WHERE seat_status != 'seat_cancelled'
          GROUP BY tour_instance_id
        ),
        -- [Self-Healing] Also fix instances with NO bookings
        -- that might still have a non-zero count
        AllBookedInstances AS (
          SELECT id, COALESCE(cc.actual_booked_seats, 0) as correct_seats
          FROM tour_instances ti
          LEFT JOIN CorrectCounts cc ON ti.id = cc.tour_instance_id
        )
        -- 2. Update ONLY the instances where the count is out of sync
        UPDATE tour_instances ti
        SET booked_seats = ab.correct_seats,
            updated_at = NOW()
        FROM AllBookedInstances ab
        WHERE ti.id = ab.id
          AND ti.booked_seats != ab.correct_seats
        RETURNING ti.id, ti.booked_seats;
      `);

      if (updatedRows.length > 0) {
        console.log(`🧾 Accountant job fixed ${updatedRows.length} out-of-sync tour(s).`);
        updatedRows.forEach(row => {
          console.log(`   - Instance ${row.id} count reset to ${row.booked_seats}`);
        });
      } else {
        console.log('🧾 All tour instance counters are in sync.');
      }

      console.log('✅ Counter reconciliation job completed.');

    } catch (err) {
      console.error('❌ Error in counter reconciliation cron job:', err);
    } finally {
      if (client) {
        client.release();
      }
    }
  });

  console.log('✅ Counter reconciliation "Accountant" scheduled (daily at 3 AM)');
};