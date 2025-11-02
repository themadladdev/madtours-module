// server/src/server.js
// This is the minimal server entry point. It wires up CORS, Stripe's raw body parser, and the MADTours routes.

import express from 'express';
import cors from 'cors';
import { config } from './config/environment.js';
import { pool } from './db/db.js';
import { startReminderCron } from './utils/tourReminderCron.js';

// --- Import MADTours Routes (FIXED) ---
import adminTourRoutes from './routes/adminTourRoutes.js';
import adminBookingRoutes from './routes/adminBookingRoutes.js';
import publicTourRoutes from './routes/publicTourRoutes.js';
// We need the controller for the webhook
import { handleStripeWebhook } from './controllers/publicTourController.js';

const app = express();

// --- Core Middleware ---

// CORS
const corsOptions = {
  origin: config.corsOrigins,
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// --- Stripe Webhook (FIXED) ---
// Must come BEFORE express.json()
app.post('/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

// JSON Parser
app.use(express.json());

// --- Routes ---
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', environment: config.nodeEnv });
});

// --- Add your MADTours routes here (FIXED) ---
app.use('/api/admin/tours', adminTourRoutes);
app.use('/api/admin/bookings', adminBookingRoutes);
app.use('/api/tours', publicTourRoutes); // Corrected from app.set to app.use


// --- Error Handling ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: config.isDevelopment ? err.message : 'Internal server error',
    ...(config.isDevelopment && { stack: err.stack }),
  });
});

// --- Server Startup ---
const startServer = async () => {
  try {
    // Test DB connection
    await pool.query('SELECT NOW()');
    
    // --- MODIFIED: Added '0.0.0.0' ---
    // This tells Express to listen on all network interfaces,
    // not just 'localhost', allowing network connections.
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${config.port} in ${config.nodeEnv} mode`);
      console.log(`[Network] Listening on all interfaces (0.0.0.0)`);
      
      // Start cron jobs
      if (config.nodeEnv === 'production') { // Corrected logic location
         startReminderCron();
      }
    });
  } catch (err) {
    console.error('❌ Failed to connect to database. Server not started.', err.message);
    process.exit(1);
  }
};

// Removed duplicate cron job start
startServer();