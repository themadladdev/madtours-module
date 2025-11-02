// ==========================================
// UTILITIES: Manifest Generator
// server/src/utils/tourManifestGenerator.js
// ==========================================

import { pool } from '../db/db.js';

export const generateManifest = async (tourInstanceId) => {
  const result = await pool.query(
    `SELECT 
      ti.id,
      ti.date,
      ti.time,
      ti.capacity,
      ti.booked_seats,
      t.name as tour_name,
      t.duration_minutes,
      t.description,
      json_agg(
        json_build_object(
          'booking_reference', b.booking_reference,
          'customer_name', c.first_name || ' ' || c.last_name,
          'customer_email', c.email,
          'customer_phone', c.phone,
          'seats', b.seats,
          'special_requests', b.special_requests,
          'payment_status', b.payment_status,
          'booking_status', b.status
        ) ORDER BY b.created_at
      ) FILTER (WHERE b.status IN ('confirmed', 'pending')) as bookings
    FROM tour_instances ti
    JOIN tours t ON ti.tour_id = t.id
    LEFT JOIN bookings b ON ti.id = b.tour_instance_id
    LEFT JOIN customers c ON b.customer_id = c.id
    WHERE ti.id = $1
    GROUP BY ti.id, t.id`,
    [tourInstanceId]
  );

  if (result.rows.length === 0) {
    throw new Error('Tour instance not found');
  }

  const manifest = result.rows[0];
  
  // Calculate totals
  const confirmedBookings = (manifest.bookings || []).filter(b => b.booking_status === 'confirmed');
  const totalSeats = confirmedBookings.reduce((sum, b) => sum + b.seats, 0);

  return {
    ...manifest,
    bookings: manifest.bookings || [],
    confirmed_bookings: confirmedBookings,
    total_confirmed_seats: totalSeats,
    available_seats: manifest.capacity - manifest.booked_seats
  };
};