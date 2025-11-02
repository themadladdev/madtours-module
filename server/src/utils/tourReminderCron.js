// ==========================================
// CRON JOB: Send Reminder Emails
// server/src/utils/tourReminderCron.js
// ==========================================

import cron from 'node-cron';
import { pool } from '../db/db.js';
import { sendBookingReminder } from '../services/tourEmailService.js';

export const startReminderCron = () => {
  // Run every day at 9 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('🔔 Running reminder email job...');

    try {
      // Get bookings for tomorrow that haven't been reminded
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDate = tomorrow.toISOString().split('T')[0];

      const result = await pool.query(
        `SELECT 
          b.id, b.booking_reference, b.seats,
          c.first_name, c.last_name, c.email,
          ti.date, ti.time,
          t.name as tour_name, t.duration_minutes
        FROM bookings b
        JOIN customers c ON b.customer_id = c.id
        JOIN tour_instances ti ON b.tour_instance_id = ti.id
        JOIN tours t ON ti.tour_id = t.id
        WHERE ti.date = $1
          AND b.status = 'confirmed'
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

          // Mark as reminded
          await pool.query(
            'UPDATE bookings SET reminder_sent = true WHERE id = $1',
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