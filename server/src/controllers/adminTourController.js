// ==========================================
// CONTROLLERS: Tour Admin Controller
// server/src/controllers/adminTourController.js
// ==========================================

import * as tourService from '../services/tourService.js';
import { generateManifest } from '../utils/tourManifestGenerator.js';
import { getAdminTourInstances } from '../utils/tourAvailabilityCalculator.js';

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

export const getManifest = async (req, res, next) => {
    try {
        const manifest = await generateManifest(req.params.id);
        res.json(manifest);
    } catch (error) {
        console.error('Error generating manifest:', error);
        next(error);
    }
};