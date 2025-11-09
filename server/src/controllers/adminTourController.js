// ==========================================
// CONTROLLERS: Tour Admin Controller
// server/src/controllers/adminTourController.js
// ==========================================

import * as tourService from '../services/tourService.js';
import { generateManifest } from '../utils/tourManifestGenerator.js';
import { getAdminTourInstances } from '../utils/tourAvailabilityCalculator.js';
import { pool } from '../db/db.js';

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

export const getSchedulesForTour = async (req, res, next) => {
    try {
        const schedules = await tourService.getSchedulesByTourId(req.params.id);
        res.json(schedules);
    } catch (error) {
        console.error('Error fetching schedules:', error);
        next(error);
    }
};

export const createSchedule = async (req, res, next) => {
    try {
        const schedule = await tourService.createSchedule(req.params.id, req.body);
        res.status(201).json(schedule);
    } catch (error) {
        console.error('Error creating schedule:', error);
        next(error);
    }
};

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
        const { tourId, startDate, endDate, status } = req.query;

        if (!startDate) {
            return res.status(400).json({ message: 'A startDate query parameter is required.' });
        }

        const effectiveEndDate = endDate || startDate;

        const queryOptions = {
            startDate,
            endDate: effectiveEndDate,
            statusFilter: status || null,
        };

        let allInstances = [];

        if (tourId) {
            // --- Case 1: Operations Hub ---
            allInstances = await getAdminTourInstances({
                ...queryOptions,
                tourId: parseInt(tourId, 10),
            });

        } else {
            // --- Case 2: Dashboard ---
            const activeTours = await tourService.getAllTours(true);

            const instancePromises = activeTours.map(tour =>
                getAdminTourInstances({
                    ...queryOptions,
                    tourId: tour.id,
                })
            );

            const results = await Promise.all(instancePromises);
            allInstances = results.flat();
        }

        allInstances.sort((a, b) => {
            if (a.date < b.date) return -1;
            if (a.date > b.date) return 1;
            if (a.time < b.time) return -1;
            if (a.time > b.time) return 1;
            return 0;
        });

        res.json(allInstances);

    } catch (error) {
        console.error('Error fetching admin tour instances:', error);
        next(error);
    }
};

// === NEW OPERATIONAL CANCELLATION CONTROLLER ===
export const operationalCancelInstance = async (req, res, next) => {
    try {
        const { tourId, date, time, reason, capacity } = req.body;
        const adminId = req.user.id; // Assuming auth middleware sets req.user

        if (!tourId || !date || !time || !reason || !capacity) {
            return res.status(400).json({ message: 'Missing required fields for cancellation.' });
        }

        const result = await tourService.operationalCancelInstance({
            tourId: parseInt(tourId, 10),
            date,
            time,
            reason,
            adminId,
            capacity: parseInt(capacity, 10)
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Error in operational cancellation:', error);
        next(error);
    }
};
// === END NEW CONTROLLER ===

// === NEW RE-INSTATEMENT CONTROLLER ===
export const reInstateInstance = async (req, res, next) => {
    try {
        const { tourId, date, time } = req.body;
        const adminId = req.user.id; // Assuming auth middleware sets req.user

        if (!tourId || !date || !time) {
            return res.status(400).json({ message: 'Missing required fields for re-instatement.' });
        }

        const result = await tourService.reInstateInstance({
            tourId: parseInt(tourId, 10),
            date,
            time,
            adminId
        });

        res.status(200).json(result);
    } catch (error) {
        console.error('Error in re-instatement:', error);
        next(error);
    }
};
// === END NEW CONTROLLER ===

// === NEW BATCH BLACKOUT/CANCELLATION CONTROLLER ===
export const batchCancelBlackout = async (req, res, next) => {
    try {
        const { tourId, startDate, endDate, reason } = req.body;
        const adminId = req.user.id; // Assuming auth middleware sets req.user

        if (!tourId || !startDate || !endDate || !reason) {
            return res.status(400).json({ message: 'Missing required fields: tourId, startDate, endDate, and reason are required.' });
        }

        console.log(`[Controller] Received batch-cancel request for Tour ${tourId} from ${startDate} to ${endDate}.`);

        const result = await tourService.batchCancelBlackout({
            tourId: parseInt(tourId, 10),
            startDate,
            endDate,
            reason,
            adminId
        });

        console.log(`[Controller] Batch-cancel success for Tour ${tourId}.`);
        res.status(200).json(result);

    } catch (error) {
        console.error('Error in batchCancelBlackout controller:', error);
        next(error);
    }
};
// === END NEW CONTROLLER ===

// --- [MODIFIED] Helper function to process trend data ---
// Creates a 7-day array, padding with 0s for days with no data.
// Assumes startDate is the correct start of the week (e.g., Monday).
const processTrendData = (queryRows, startDate, numDays, valueField) => {
  const trendMap = new Map(
    queryRows.map(row => [row.day.toISOString().split('T')[0], parseFloat(row[valueField])])
  );
  
  const trendData = [];
  const processingDate = new Date(startDate.getTime()); // Clone the date

  for (let i = 0; i < numDays; i++) {
    const dateKey = processingDate.toISOString().split('T')[0];
    trendData.push(trendMap.get(dateKey) || 0);
    processingDate.setDate(processingDate.getDate() + 1); // Increment day
  }
  return trendData;
};

// === [REWRITTEN] DIRECTIONAL DASHBOARD CONTROLLER ===
// This function has been refactored to use the new schema
//
export const getDirectionalDashboard = async (req, res, next) => {
    try {
        // --- 1. Triage Queries (REFACTORED) ---
        const triagePendingTriageQuery = pool.query(
            "SELECT COUNT(*) FROM tour_bookings WHERE seat_status = 'triage'"
        );
        const triagePendingBookingsQuery = pool.query(
            `SELECT COUNT(*) FROM tour_bookings 
             WHERE seat_status = 'seat_pending' 
               AND payment_status = 'payment_stripe_pending'
               AND created_at < NOW() - INTERVAL '1 hour'`
        );
        const triageFailedPaymentsQuery = pool.query(
            "SELECT COUNT(*) FROM tour_bookings WHERE payment_status = 'refund_stripe_failed'"
        );

        // --- 2. Booking Statistics (REFACTORED) ---
        const commonBookingStats = `
            SELECT 
                COALESCE(COUNT(*), 0) as bookings,
                COALESCE(SUM(total_amount), 0) as revenue
            FROM tour_bookings 
            WHERE seat_status = 'seat_confirmed' AND
        `;
        const bookingStatsTodayQuery = pool.query(
            `${commonBookingStats} DATE(created_at) = CURRENT_DATE`
        );
        const bookingStatsWeekQuery = pool.query(
            `${commonBookingStats} DATE(created_at) >= DATE_TRUNC('week', CURRENT_DATE)`
        );
        const bookingStatsWeekTrendQuery = pool.query(
            `SELECT 
                DATE(created_at) as day, 
                COALESCE(SUM(total_amount), 0) as revenue
             FROM tour_bookings
             WHERE seat_status = 'seat_confirmed' 
               AND DATE(created_at) >= DATE_TRUNC('week', CURRENT_DATE)
               AND DATE(created_at) <= (DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '6 days')
             GROUP BY day
             ORDER BY day ASC`
        );
        const bookingStatsMonthQuery = pool.query(
            `${commonBookingStats} DATE(created_at) >= DATE_TRUNC('month', CURRENT_DATE)`
        );
        const bookingStatsYTDQuery = pool.query(
            `${commonBookingStats} DATE(created_at) >= DATE_TRUNC('year', CURRENT_DATE)`
        );

        // --- 3. Tour Statistics (REFACTORED) ---
        const commonTourStats = `
            SELECT 
                COALESCE(SUM(b.seats), 0) as seats, 
                COALESCE(SUM(b.total_amount), 0) as value
            FROM tour_bookings b
            JOIN tour_instances i ON b.tour_instance_id = i.id
            WHERE b.seat_status = 'seat_confirmed' AND
        `;
        const tourStatsTodayQuery = pool.query(
            `${commonTourStats} i.date = CURRENT_DATE`
        );
        const tourStatsWeekQuery = pool.query(
            `${commonTourStats} i.date >= CURRENT_DATE AND i.date <= (DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '6 days')`
        );
        const tourStatsWeekTrendQuery = pool.query(
            `SELECT 
                i.date as day, 
                COALESCE(SUM(b.total_amount), 0) as value
             FROM tour_bookings b
             JOIN tour_instances i ON b.tour_instance_id = i.id
             WHERE b.seat_status = 'seat_confirmed' 
               AND i.date >= CURRENT_DATE 
               AND i.date <= (DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '6 days')
             GROUP BY day
             ORDER BY day ASC`
        );
        const tourStatsMonthQuery = pool.query(
            `${commonTourStats} i.date >= CURRENT_DATE AND i.date <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')`
        );
        const tourStats90DayQuery = pool.query(
            `${commonTourStats} i.date > CURRENT_DATE AND i.date <= (CURRENT_DATE + INTERVAL '90 days')`
        );

        // --- Run all queries in parallel ---
        const [
            triagePendingTriage,
            triagePendingBookings,
            triageFailedPayments,
            bookingStatsToday,
            bookingStatsWeek,
            bookingStatsWeekTrend,
            bookingStatsMonth,
            bookingStatsYTD,
            tourStatsToday,
            tourStatsWeek,
            tourStatsWeekTrend,
            tourStatsMonth,
            tourStats90Day,
            dbWeekStartDate
        ] = await Promise.all([
            triagePendingTriageQuery,
            triagePendingBookingsQuery,
            triageFailedPaymentsQuery,
            bookingStatsTodayQuery,
            bookingStatsWeekQuery,
            bookingStatsWeekTrendQuery,
            bookingStatsMonthQuery,
            bookingStatsYTDQuery,
            tourStatsTodayQuery,
            tourStatsWeekQuery,
            tourStatsWeekTrendQuery,
            tourStatsMonthQuery,
            tourStats90DayQuery,
            pool.query("SELECT DATE_TRUNC('week', CURRENT_DATE) as week_start")
        ]);
        
        const pgStartOfWeek = dbWeekStartDate.rows[0].week_start;
        const bookingTrend = processTrendData(bookingStatsWeekTrend.rows, pgStartOfWeek, 7, 'revenue');
        const tourTrend = processTrendData(tourStatsWeekTrend.rows, new Date(), 7, 'value'); 

        const formatStats = (row) => ({
            bookings: parseInt(row.bookings, 10),
            revenue: parseFloat(row.revenue)
        });
        const formatTourStats = (row) => ({
            seats: parseInt(row.seats, 10),
            value: parseFloat(row.value)
        });

        const dashboardData = {
            triage: {
                pending_triage: parseInt(triagePendingTriage.rows[0].count, 10),
                pending_bookings: parseInt(triagePendingBookings.rows[0].count, 10),
                failed_payments: parseInt(triageFailedPayments.rows[0].count, 10),
            },
            bookingStats: {
                today: formatStats(bookingStatsToday.rows[0]),
                week: { ...formatStats(bookingStatsWeek.rows[0]), trend: bookingTrend },
                month: formatStats(bookingStatsMonth.rows[0]),
                ytd: formatStats(bookingStatsYTD.rows[0]),
            },
            tourStats: {
                today: formatTourStats(tourStatsToday.rows[0]),
                week: { ...formatTourStats(tourStatsWeek.rows[0]), trend: tourTrend },
                month: formatTourStats(tourStatsMonth.rows[0]),
                next90Days: formatTourStats(tourStats90Day.rows[0]),
            }
        };

        res.json(dashboardData);

    } catch (error) {
        console.error('Error fetching directional dashboard data:', error);
        next(error);
    }
};
// === [END REWRITE] ===

export const getManifest = async (req, res, next) => {
    try {
        const manifest = await generateManifest(req.params.id);
        res.json(manifest);
    } catch (error) {
        console.error('Error generating manifest:', error);
        next(error);
    }
};