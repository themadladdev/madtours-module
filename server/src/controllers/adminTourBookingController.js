// ==========================================
// server/src/controllers/adminTourBookingController.js
// ==========================================

import { pool } from '../db/db.js';
import * as bookingService from '../services/tourBookingService.js';
import * as adminBookingService from '../services/adminTourBookingService.js';
import { processRefund, retryStripeRefund as retryStripeRefundService } from '../services/tourStripeService.js';
import { sanitizeInput, sanitizeTicketBookingData } from '../utils/tourSanitize.js';

/**
 * --- [REFACTORED] createManualBooking (Origin 2) ---
 * Now a thin controller that calls the admin booking service.
 */
export const createManualBooking = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const sanitizedData = sanitizeTicketBookingData(req.body);
    
    const newBooking = await adminBookingService.createManualBooking(sanitizedData, adminId);
    
    res.status(201).json(newBooking);

  } catch (error) {
    console.error('Error creating manual booking:', error);
    if (error.message.includes('seats available') || error.message.includes('tour is no longer scheduled')) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * --- [REFACTORED] createFocBooking (Origin 3) ---
 * Now a thin controller that calls the admin booking service.
 */
export const createFocBooking = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const sanitizedData = sanitizeTicketBookingData(req.body);
    const { adminNotes } = req.body; 
    
    const newBooking = await adminBookingService.createFocBooking(sanitizedData, adminNotes, adminId);
    
    res.status(201).json(newBooking);

  } catch (error) {
    console.error('Error creating FOC booking:', error);
    if (error.message.includes('seats available') || error.message.includes('tour is no longer scheduled')) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * Updated to handle new, complex 'special_filter' queries for the admin badges.
 */
export const getAllBookings = async (req, res, next) => {
  try {
    const { seat_status, payment_status, startDate, endDate, searchTerm, special_filter } = req.query;
    
    let query = `
      SELECT 
        b.id, b.booking_reference, b.tour_instance_id, b.customer_id, b.seats,
        b.total_amount, b.seat_status, b.special_requests, b.payment_intent_id,
        b.payment_status, b.refund_amount, b.refunded_at, b.cancelled_at,
        b.cancellation_reason, b.created_at, b.updated_at, b.reminder_sent,
        b.customer_notes, 
        b.admin_notes,
        c.first_name, c.last_name, c.email, c.phone,
        ti.date, ti.time,
        t.name as tour_name
      FROM tour_bookings b
      JOIN tour_customers c ON b.customer_id = c.id
      JOIN tour_instances ti ON b.tour_instance_id = ti.id
      JOIN tours t ON ti.tour_id = t.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;

    if (special_filter) {
      // --- [MODIFIED] "Action Required" is now only Triage, Failed Refunds, and Missed Payments ---
      if (special_filter === 'action_required') {
        query += ` AND (
          b.seat_status = 'triage' OR
          b.payment_status = 'refund_stripe_failed' OR
          (b.payment_status = 'payment_manual_pending' AND ti.date < CURRENT_DATE)
        )`;
      } 
      // --- [NEW] "Pending Inventory" is *only* stuck "seat_pending" bookings ---
      else if (special_filter === 'pending_inventory') {
         query += ` AND (b.seat_status = 'seat_pending' AND b.created_at < (NOW() - INTERVAL '1 hour'))`;
      }
      else if (special_filter === 'pay_on_arrival_queue') {
         query += ` AND (b.payment_status = 'payment_manual_pending' AND ti.date >= CURRENT_DATE)`;
      }
      // --- [DEPRECATED] Removed old granular filters ---
      // else if (special_filter === 'triage_queue') { ... }
      // else if (special_filter === 'stuck_pending_queue') { ... }
      // else if (special_filter === 'missed_payment_queue') { ... }

    } else {
      if (seat_status) {
        query += ` AND b.seat_status = $${paramCount++}`;
        params.push(seat_status);
      }
      if (payment_status) {
        query += ` AND b.payment_status = $${paramCount++}`;
        params.push(payment_status);
      }
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

export const updateAdminNotes = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.user.id; 

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
    const adminId = req.user.id; 
    
    if (!reason) {
      return res.status(400).json({ message: 'Refund reason is required' });
    }

    const refund = await processRefund(id, adminId, amount, reason);

    res.json({ message: 'Refund processed successfully', refund });
    
  } catch (error) {
    console.error(`Error processing refund for booking ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Triage Action: Mark a manually-paid booking as manually-refunded.
 */
export const manualMarkRefunded = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    if (!reason) {
      return res.status(400).json({ message: 'Refund reason is required' });
    }
    
    const booking = await adminBookingService.adminManualRefund({
      bookingId: id,
      reason,
      adminId
    });

    res.json({ message: 'Booking marked as manually refunded', booking });
  } catch (error) {
    console.error(`Error marking manual refund for booking ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Triage Action: Retry a failed Stripe refund.
 */
export const retryStripeRefund = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const refund = await retryStripeRefundService(id, adminId);

    res.json({ message: 'Stripe refund retry initiated', refund });
  } catch (error) {
    console.error(`Error retrying refund for booking ${req.params.id}:`, error);
    next(error);
  }
};


export const getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const statsQuery = `
      SELECT
        (SELECT COUNT(*) FROM tour_instances WHERE date >= $1 AND status = 'scheduled') as upcoming_tours,
        (SELECT COUNT(*) FROM tour_bookings WHERE seat_status = 'seat_confirmed') as total_confirmed_bookings,
        (SELECT COUNT(*) FROM tour_bookings WHERE seat_status = 'seat_pending') as pending_bookings
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
    
    const updatedBooking = await adminBookingService.manualConfirmBooking(id, reason, adminId);
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
    
    const updatedBooking = await adminBookingService.manualMarkAsPaid(id, reason, adminId);
    res.json({ message: 'Booking manually marked as paid', booking: updatedBooking });

  } catch (error) {
    console.error(`Error manually marking booking ${req.params.id} as paid:`, error);
    next(error);
  }
};