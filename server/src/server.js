// ==========================================
// UPDATED FILE
// server/src/server.js
// ==========================================
// This is the minimal server entry point. It wires up CORS, Stripe's raw body parser, and the MADTours routes.

import express from 'express';
import cors from 'cors';
import { config } from './config/environment.js';
import { pool } from './db/db.js';

// --- Cron Jobs ---
import { 
  startReminderCron, 
  startAbandonedCartCron,
  startReconciliationCron 
} from './utils/tourReminderCron.js';

// --- Import MADTours Routes ---
import adminTourRoutes from './routes/adminTourRoutes.js';
import adminBookingRoutes from './routes/adminBookingRoutes.js';
import publicTourRoutes from './routes/publicTourRoutes.js';
import adminTicketRoutes from './routes/adminTicketRoutes.js';

// --- Import the NEW webhook routes ---
import stripeWebhookRoutes from './routes/stripeWebhookRoutes.js'; 

const app = express();

// --- Core Middleware ---

// CORS
const corsOptions = {
  origin: config.corsOrigins,
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// --- [MODIFIED] Stripe Webhook Parser ---
// Now listening at /api/stripe/webhook
app.use('/api/stripe', 
  express.raw({ type: 'application/json' }), 
  (req, res, next) => {
    // Attach the raw body to the request object for the controller
    req.rawBody = req.body;
    next();
  }
);
// --- [END MODIFIED] ---


// JSON Parser (applies to all routes *except* the webhook)
app.use(express.json());

// --- Routes ---
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', environment: config.nodeEnv });
});

// --- [MODIFIED] Add the new Stripe webhook route (no /v1) ---
app.use('/api/stripe', stripeWebhookRoutes);

// --- [MODIFIED] Standard MADTours routes (no /v1) ---
app.use('/api/admin/tours', adminTourRoutes);
app.use('/api/admin/bookings', adminBookingRoutes);
app.use('/api/tours', publicTourRoutes);
app.use('/api/admin/tickets', adminTicketRoutes);


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
    
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${config.port} in ${config.nodeEnv} mode`);
      console.log(`[Network] Listening on all interfaces (0.0.0.0)`);
      
      // --- Start cron jobs ---
      if (config.nodeEnv === 'production' || config.nodeEnv === 'development') {
         console.log('Starting cron jobs for development/production...');
         startReminderCron();
         startAbandonedCartCron();
         startReconciliationCron();
      } else {
         console.log('Cron jobs are disabled for this environment.');
      }
    });
  } catch (err) {
    console.error('❌ Failed to connect to database. Server not started.', err.message);
    process.exit(1);
  }
};

startServer();