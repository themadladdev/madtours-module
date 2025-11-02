// ==========================================
// ROUTES: Admin Tour Management
// server/src/routes/adminTourRoutes.js
// ==========================================

import express from 'express';
import { authenticateAdmin } from '../middleware/adminAuth.js';
import * as adminTourController from '../controllers/adminTourController.js';

const router = express.Router();

// All routes in this file are protected by admin auth
router.use(authenticateAdmin);

// === Tour Instances (Daily Operations) ===
// Static routes MUST be defined *before* dynamic routes like '/:id'
router.get('/instances', adminTourController.getTourInstances);
router.get('/instances/:id/manifest', adminTourController.getManifest);

// === NEW CANCELLATION & RE-INSTATEMENT ROUTES ===
router.post('/instances/cancel-operationally', adminTourController.operationalCancelInstance);
router.post('/instances/re-instate', adminTourController.reInstateInstance);

// === NEW BATCH BLACKOUT/CANCELLATION ROUTE ===
router.post('/instances/batch-cancel-blackout', adminTourController.batchCancelBlackout);
// === END NEW ROUTE ===


// === Tour Schedules ===
// Static routes MUST be defined *before* dynamic routes like '/:id'
router.post('/schedules/:scheduleId/generate', adminTourController.generateInstances);

// PUT /api/admin/schedules/:scheduleId
router.put('/schedules/:scheduleId', adminTourController.updateSchedule);


// === Tour Management (Dynamic routes go LAST) ===
// GET    /api/admin/tours
router.get('/', adminTourController.getAllTours);

// POST   /api/admin/tours
router.post('/', adminTourController.createTour);

// GET    /api/admin/tours/:id
router.get('/:id', adminTourController.getTourById);

// PUT    /api/admin/tours/:id
router.put('/:id', adminTourController.updateTour);

// DELETE /api/admin/tours/:id
router.delete('/:id', adminTourController.deleteTour);

// GET    /api/admin/tours/:id/schedules
router.get('/:id/schedules', adminTourController.getSchedulesForTour);

// POST   /api/admin/tours/:id/schedules
router.post('/:id/schedules', adminTourController.createSchedule);

export default router;