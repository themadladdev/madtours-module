// ==========================================
// CONTROLLERS: Booking Admin Controller
// server/src/controllers/tourBookingAdminController.js
// ==========================================

import { pool } from '../db/db.js';
import * as bookingService from '../services/tourBookingService.js';
import { processRefund } from '../services/tourStripeService.js';

export const getAllBookings = async (req, res, next) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        b.*,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        ti.date,
        ti.time,
        t.name as tour_name
      FROM tour_bookings b
      JOIN tour_customers c ON b.customer_id = c.id
      JOIN tour_instances ti ON b.tour_instance_id = ti.id
      JOIN tours t ON ti.tour_id = t.id
      WHERE 1=1
    `;
    
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

export const cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id; // From authenticateAdmin stub

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
    
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    next(error);
  }
};