// ==========================================
// server/src/controllers/adminTourBookingController.js
// ==========================================

import { pool } from '../db/db.js';
import * as bookingService from '../services/tourBookingService.js';
import { processRefund } from '../services/tourStripeService.js';
// --- [NEW] Import a basic sanitizer ---
import { sanitizeInput } from '../utils/tourSanitize.js';

export const getAllBookings = async (req, res, next) => {
  try {
    const { status, startDate, endDate, searchTerm } = req.query;
    
    // --- [MODIFIED] Explicitly listed all columns to add customer_notes/admin_notes ---
    let query = `
      SELECT 
        b.id, b.booking_reference, b.tour_instance_id, b.customer_id, b.seats,
        b.total_amount, b.status, b.special_requests, b.payment_intent_id,
        b.payment_status, b.refund_amount, b.refunded_at, b.cancelled_at,
        b.cancellation_reason, b.created_at, b.updated_at, b.reminder_sent,
        b.customer_notes, 
        b.admin_notes, -- [NEW]
        c.first_name, c.last_name, c.email, c.phone,
        ti.date, ti.time,
        t.name as tour_name
      FROM tour_bookings b
      JOIN tour_customers c ON b.customer_id = c.id
      JOIN tour_instances ti ON b.tour_instance_id = ti.id
      JOIN tours t ON ti.tour_id = t.id
      WHERE 1=1
    `;
    // --- [END MODIFICATION] ---
    
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND b.status = $${paramCount++}`;
      params.push(status);
    }

    if (startDate) {
      query += ` AND ti.date >= $${paramCount++}`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND ti.date <= $${paramCount++}`;
      params.push(endDate);
    }

    if (searchTerm) {
      const searchPattern = `%${searchTerm}%`;
      query += ` AND (
        c.first_name ILIKE $${paramCount} OR 
        c.last_name ILIKE $${paramCount + 1} OR 
        b.booking_reference ILIKE $${paramCount + 2}
      )`;
      params.push(searchPattern, searchPattern, searchPattern);
      paramCount += 3;
    }

    query += ' ORDER BY ti.date DESC, ti.time DESC, b.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching all bookings:', error);
    next(error);
  }
};

export const getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // --- [MODIFIED] Add b.admin_notes ---
    // b.* already selects customer_notes and admin_notes, this is safe.
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
      WHERE b.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json(result.rows[0]);
    
  } catch (error) {
    console.error(`Error fetching booking ${req.params.id}:`, error);
    next(error);
  }
};

// --- [NEW] Controller function for Admin Notes ---
export const updateAdminNotes = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.user.id; // From auth stub

    // Sanitize the raw text content
    const sanitizedNotes = sanitizeInput(adminNotes);

    const result = await pool.query(
      `UPDATE tour_bookings
       SET admin_notes = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, admin_notes, updated_at`,
      [sanitizedNotes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Add to history
    await pool.query(
      `INSERT INTO tour_booking_history 
       (booking_id, new_status, changed_by_admin, reason)
       VALUES ($1, $2, $3, $4)`,
      [id, 'updated', adminId, 'Admin notes updated']
    );

    res.json(result.rows[0]);

  } catch (error) {
    console.error(`Error updating admin notes for booking ${req.params.id}:`, error);
    next(error);
  }
};
// --- [END NEW FUNCTION] ---

// --- (Unchanged functions: cancelBooking, refundBooking, getDashboardStats, updateBookingPassengers, manualConfirmBooking, manualMarkAsPaid, manualCancelBooking) ---
export const cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id; 

    if (!reason) {
      return res.status(400).json({ message: 'Cancellation reason is required' });
    }
    
    const cancelledBooking = await bookingService.cancelBooking(id, reason, adminId);
    
    res.json({ message: 'Booking cancelled successfully', booking: cancelledBooking });
    
  } catch (error) {
    console.error(`Error cancelling booking ${req.params.id}:`, error);
    next(error);
  }
};

export const refundBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ message: 'Refund reason is required' });
    }

    const refund = await processRefund(id, amount, reason);

    res.json({ message: 'Refund processed successfully', refund });
    
  } catch (error) {
    console.error(`Error processing refund for booking ${req.params.id}:`, error);
    next(error);
  }
};

export const getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const statsQuery = `
      SELECT
        (SELECT COUNT(*) FROM tour_instances WHERE date >= $1 AND status = 'scheduled') as upcoming_tours,
        (SELECT COUNT(*) FROM tour_bookings WHERE status = 'confirmed') as total_confirmed_bookings,
        (SELECT COUNT(*) FROM tour_bookings WHERE status = 'pending') as pending_bookings
    `;
    
    const result = await pool.query(statsQuery, [today]);
    
    res.json({ stats: result.rows[0] });
    
  } catch (error)
 {
    console.error('Error fetching dashboard stats:', error);
    next(error);
  }
};

export const updateBookingPassengers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { passengers } = req.body;

    if (!passengers || !Array.isArray(passengers)) {
      return res.status(400).json({ message: 'Invalid passenger data' });
    }

    await bookingService.updateBookingPassengers(id, passengers);
    
    res.json({ message: 'Passengers updated successfully' });

  } catch (error) {
    console.error(`Error updating passengers for booking ${req.params.id}:`, error);
    next(error);
  }
};

export const manualConfirmBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;
    
    const updatedBooking = await bookingService.manualConfirmBooking(id, reason, adminId);
    res.json({ message: 'Booking manually confirmed', booking: updatedBooking });
    
  } catch (error) {
    console.error(`Error manually confirming booking ${req.params.id}:`, error);
    next(error);
  }
};

export const manualMarkAsPaid = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;
    
    const updatedBooking = await bookingService.manualMarkAsPaid(id, reason, adminId);
    res.json({ message: 'Booking manually marked as paid', booking: updatedBooking });

  } catch (error) {
    console.error(`Error manually marking booking ${req.params.id} as paid:`, error);
    next(error);
  }
};

export const manualCancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    if (!reason) {
      return res.status(400).json({ message: 'Cancellation reason is required' });
    }
    
    const cancelledBooking = await bookingService.cancelBooking(id, reason, adminId);
    
    res.json({ message: 'Booking cancelled successfully', booking: cancelledBooking });
    
  } catch (error) {
    console.error(`Error manually cancelling booking ${req.params.id}:`, error);
    next(error);
  }
};