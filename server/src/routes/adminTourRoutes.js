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
router.post('/instances/:id/cancel', adminTourController.cancelTourInstance);
router.get('/instances/:id/manifest', adminTourController.getManifest);

// === Tour Schedules ===
// Static routes MUST be defined *before* dynamic routes like '/:id'
router.post('/schedules/:scheduleId/generate', adminTourController.generateInstances);

// === NEW ROUTE (Bug 3) ===
// PUT /api/admin/schedules/:scheduleId
router.put('/schedules/:scheduleId', adminTourController.updateSchedule);
// === END NEW ROUTE ===


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

// === NEW ROUTE (Bug 1 - 404 Error) ===
// GET    /api/admin/tours/:id/schedules
router.get('/:id/schedules', adminTourController.getSchedulesForTour);
// === END NEW ROUTE ===

// POST   /api/admin/tours/:id/schedules
router.post('/:id/schedules', adminTourController.createSchedule);

export default router;