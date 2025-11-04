// server/src/routes/adminTicketRoutes.js
// Defines API routes for managing the Ticket Library (Definitions, Recipes, and Prices)

import express from 'express';
import * as controller from '../controllers/adminTicketController.js';
// import { adminAuth } from '../middleware/adminAuth.js'; // Future auth

const router = express.Router();

// --- Middleware (apply to all routes in this file) ---
// router.use(adminAuth); // Uncomment when auth is ready

// --- 1. tour_tickets (Ticket Definitions) ---
router.get('/definitions', controller.getAllTicketDefinitions);
router.post('/definitions', controller.createTicketDefinition);
router.put('/definitions/:id', controller.updateTicketDefinition);
router.delete('/definitions/:id', controller.deleteTicketDefinition);

// --- 2. tour_tickets_combined (Combined Ticket Recipes) ---
// These are managed *under* a specific ticket definition
router.get('/definitions/:id/recipe', controller.getCombinedTicketRecipe);
router.post('/definitions/:id/recipe', controller.setCombinedTicketRecipe);

// --- 3. tour_pricing (Tour-specific Pricing) ---
// Get all pricing rules for a specific tour
router.get('/pricing/tour/:tourId', controller.getPricingForTour);
// Set all pricing rules for a specific tour (full overwrite)
router.post('/pricing/tour/:tourId', controller.setPricingForTour);

export default router;