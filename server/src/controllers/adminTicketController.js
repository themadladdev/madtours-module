// server/src/controllers/adminTicketController.js
// Handles HTTP requests for the Admin Ticket Library routes.

import * as ticketService from '../services/adminTicketService.js';

// --- 1. tour_tickets (Ticket Definitions) ---

export const getAllTicketDefinitions = async (req, res, next) => {
  try {
    const definitions = await ticketService.getAllTicketDefinitions();
    res.status(200).json(definitions);
  } catch (error) {
    next(error);
  }
};

export const createTicketDefinition = async (req, res, next) => {
  try {
    const { name, type } = req.body;
    if (!name || !type) {
      return res.status(400).json({ message: 'Name and type are required' });
    }
    const newDefinition = await ticketService.createTicketDefinition({ name, type });
    res.status(201).json(newDefinition);
  } catch (error) {
    next(error);
  }
};

export const updateTicketDefinition = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, type } = req.body;
    if (!name || !type) {
      return res.status(400).json({ message: 'Name and type are required' });
    }
    const updatedDefinition = await ticketService.updateTicketDefinition(id, { name, type });
    res.status(200).json(updatedDefinition);
  } catch (error) {
    next(error);
  }
};

export const deleteTicketDefinition = async (req, res, next) => {
  try {
    const { id } = req.params;
    await ticketService.deleteTicketDefinition(id);
    res.status(204).send(); // No Content
  } catch (error) {
    next(error);
  }
};

// --- 2. tour_tickets_combined (Combined Ticket Recipes) ---

export const getCombinedTicketRecipe = async (req, res, next) => {
  try {
    const { id } = req.params;
    const recipe = await ticketService.getCombinedTicketRecipe(id);
    res.status(200).json(recipe);
  } catch (error) {
    next(error);
  }
};

export const setCombinedTicketRecipe = async (req, res, next) => {
  try {
    const { id } = req.params; // This is the combined_ticket_id
    const { recipe } = req.body; // Expects an array: [{ atomic_ticket_id: 1, quantity: 2 }, ...]
    
    if (!Array.isArray(recipe)) {
      return res.status(400).json({ message: 'Recipe must be an array' });
    }
    
    const newRecipe = await ticketService.setCombinedTicketRecipe(id, recipe);
    res.status(201).json(newRecipe);
  } catch (error) {
    next(error);
  }
};

// --- 3. tour_pricing (Tour-specific Pricing) ---

export const getPricingForTour = async (req, res, next) => {
  try {
    const { tourId } = req.params;
    const pricingRules = await ticketService.getPricingForTour(tourId);
    res.status(200).json(pricingRules);
  } catch (error) {
    next(error);
  }
};

export const setPricingForTour = async (req, res, next) => {
  try {
    const { tourId } = req.params;
    const { pricing } = req.body; // Expects an array: [{ ticket_id: 1, price: 100.00 }, ...]

    if (!Array.isArray(pricing)) {
      return res.status(400).json({ message: 'Pricing must be an array' });
    }

    const newPricing = await ticketService.setPricingForTour(tourId, pricing);
    res.status(201).json(newPricing);
  } catch (error) {
    next(error);
  }
};