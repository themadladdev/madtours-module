// ==========================================
// server/src/utils/tourManifestGenerator.js
// ==========================================

import { pool } from '../db/db.js';

export const generateManifest = async (tourInstanceId) => {
  
  // --- Query 1: Get Confirmed Bookings (Existing Query) ---
  const manifestResult = await pool.query(
    `SELECT 
      ti.id,
      ti.tour_id, -- [NEW] Added tour_id for the manual booking modal
      ti.date,
      ti.time,
      ti.capacity,
      ti.booked_seats,
      t.name as tour_name,
      t.duration_minutes,
      t.description,
      
      json_agg(
        json_build_object(
          'booking_id', b.id,
          'booking_reference', b.booking_reference,
          'seats_total', b.seats,
          'special_requests', b.special_requests,
          'payment_status', b.payment_status,
          'seat_status', b.seat_status,
          
          'passengers', (
            SELECT json_agg(
              json_build_object(
                'first_name', p.first_name,
                'last_name', p.last_name,
                'ticket_type', p.ticket_type
              )
            )
            FROM tour_booking_passengers p
            WHERE p.booking_id = b.id
          ),
          
          'customer', json_build_object(
            'first_name', c.first_name,
            'last_name', c.last_name,
            'email', c.email,
            'phone', c.phone
          )
        ) ORDER BY b.created_at
      ) 
      FILTER (WHERE b.seat_status = 'seat_confirmed') as confirmed_bookings 

    FROM tour_instances ti
    JOIN tours t ON ti.tour_id = t.id
    LEFT JOIN tour_bookings b ON ti.id = b.tour_instance_id
    LEFT JOIN tour_customers c ON b.customer_id = c.id
    WHERE ti.id = $1
    GROUP BY ti.id, t.id`,
    [tourInstanceId]
  );

  if (manifestResult.rows.length === 0) {
    throw new Error('Tour instance not found');
  }

  // --- [NEW] Query 2: Get Pending Inventory Count ---
  // Get the SUM of seats for bookings that are "stuck hostage"
  const pendingInventoryResult = await pool.query(
    `SELECT COALESCE(SUM(seats), 0) as seats_held
     FROM tour_bookings
     WHERE tour_instance_id = $1
       AND seat_status = 'seat_pending'
       AND payment_status = 'payment_stripe_pending'`,
    [tourInstanceId]
  );
  
  const pending_inventory_seats = parseInt(pendingInventoryResult.rows[0].seats_held, 10) || 0;
  // --- [END NEW] ---

  const manifest = manifestResult.rows[0];
  
  const confirmedBookings = manifest.confirmed_bookings || [];
  
  const totalSeats = confirmedBookings.reduce((sum, b) => sum + b.seats_total, 0);

  return {
    ...manifest,
    confirmed_bookings: confirmedBookings,
    total_confirmed_seats: totalSeats,
    available_seats: manifest.capacity - manifest.booked_seats,
    // --- [NEW] Add the pending count to the response ---
    pending_inventory_seats: pending_inventory_seats 
  };
};