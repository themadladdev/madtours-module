// ==========================================
// CONTROLLERS: Tour Admin Controller
// server/src/controllers/adminTourController.js
// ==========================================

import * as tourService from '../services/tourService.js';
import { generateManifest } from '../utils/tourManifestGenerator.js';

export const createTour = async (req, res, next) => {
  try {
    const tour = await tourService.createTour(req.body);
    res.status(201).json(tour);
  } catch (error) {
    console.error('Error creating tour:', error);
    next(error);
  }
};

export const getAllTours = async (req, res, next) => {
  try {
    const activeOnly = req.query.active === 'true';
    const tours = await tourService.getAllTours(activeOnly);
    res.json(tours);
  } catch (error) {
    console.error('Error fetching tours:', error);
    next(error);
  }
};

export const getTourById = async (req, res, next) => {
  try {
    const tour = await tourService.getTourById(req.params.id);
    if (!tour) {
      return res.status(404).json({ message: 'Tour not found' });
    }
    res.json(tour);
  } catch (error) {
    console.error('Error fetching tour:', error);
    next(error);
  }
};

export const updateTour = async (req, res, next) => {
  try {
    const tour = await tourService.updateTour(req.params.id, req.body);
    if (!tour) {
      return res.status(404).json({ message: 'Tour not found' });
    }
    res.json(tour);
  } catch (error) {
    console.error('Error updating tour:', error);
    next(error);
  }
};

export const deleteTour = async (req, res, next) => {
  try {
    await tourService.deleteTour(req.params.id);
    res.json({ message: 'Tour deleted successfully' });
  } catch (error) {
    console.error('Error deleting tour:', error);
    next(error);
  }
};

// === NEW CONTROLLER FUNCTION ===
export const getSchedulesForTour = async (req, res, next) => {
  try {
    const schedules = await tourService.getSchedulesByTourId(req.params.id);
    res.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    next(error);
  }
};
// === END NEW FUNCTION ===

export const createSchedule = async (req, res, next) => {
  try {
    const schedule = await tourService.createSchedule(req.params.id, req.body);
    res.status(201).json(schedule);
  } catch (error) {
    console.error('Error creating schedule:', error);
    next(error);
  }
};

// === NEW CONTROLLER FUNCTION ===
export const updateSchedule = async (req, res, next) => {
  try {
    const schedule = await tourService.updateSchedule(req.params.scheduleId, req.body);
    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }
    res.json(schedule);
  } catch (error) {
    console.error('Error updating schedule:', error);
    next(error);
  }
};
// === END NEW FUNCTION ===

export const generateInstances = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.body;
    const instances = await tourService.generateTourInstances(
      req.params.scheduleId,
      startDate,
      endDate
    );
    res.status(201).json({ 
      message: `Generated ${instances.length} tour instances`,
      instances 
    });
  } catch (error) {
    console.error('Error generating instances:', error);
    next(error);
  }
};

export const getTourInstances = async (req, res, next) => {
  try {
    // This logic should be moved to tourService.js, but
    // we will leave it for now to minimize changes.
    const { startDate, endDate, status } = req.query;
    
    let query = `
      SELECT 
        ti.*,
        t.name as tour_name,
        t.base_price,
        (ti.capacity - ti.booked_seats) as available_seats
      FROM tour_instances ti
      JOIN tours t ON ti.tour_id = t.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;

    if (startDate) {
      query += ` AND ti.date >= $${paramCount++}`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND ti.date <= $${paramCount++}`;
      params.push(endDate);
    }

    if (status) {
      query += ` AND ti.status = $${paramCount++}`;
      params.push(status);
    }

    query += ' ORDER BY ti.date, ti.time';

    const { pool } = await import('../db/db.js');
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching instances:', error);
    next(error);
  }
};

// === REFACTORED CONTROLLER FUNCTION ===
export const cancelTourInstance = async (req, res, next) => {
  try {
    const { reason } = req.body;
    
    // This now calls the correct service which handles
    // refunds, history, and email notifications.
    const result = await tourService.cancelTourInstanceWithRefunds(
      req.params.id, 
      reason, 
      req.user.id
    );

    res.json(result);
  } catch (error) {
    console.error('Error cancelling tour instance:', error);
    next(error);
  }
};
// === END REFACTORED FUNCTION ===

export const getManifest = async (req, res, next) => {
  try {
    const manifest = await generateManifest(req.params.id);
    res.json(manifest);
  } catch (error) {
    console.error('Error generating manifest:', error);
    next(error);
  }
};