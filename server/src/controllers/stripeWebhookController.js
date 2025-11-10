// server/src/controllers/stripeWebhookController.js
import stripePackage from 'stripe';
import { config } from '../config/environment.js';
// --- [FIX] ---
// Import the ONE AND ONLY function we need from the service
import { handleWebhook as handleWebhookService } from '../services/tourStripeService.js';
// --- [END FIX] ---

// Initialize Stripe with the Secret Key
const stripe = new stripePackage(config.stripeSecretKey);

export const handleStripeWebhook = async (req, res, next) => {
  // Get the signature from the headers
  const sig = req.headers['stripe-signature'];
  
  // Get the raw body (which server.js will provide)
  const rawBody = req.rawBody; 

  // Get the correct webhook secret from your .env.development file
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_DEV;
  if (!webhookSecret) {
    console.error('❌ FATAL: STRIPE_WEBHOOK_SECRET_DEV is not set in environment.');
    return res.status(500).send('Webhook secret not configured.');
  }

  let event;

  try {
    // Verify the event came from Stripe, using the Webhook Secret
    event = stripe.webhooks.constructEvent(
      rawBody, 
      sig, 
      webhookSecret // Use the correct variable
    );
  } catch (err) {
    console.error(`❌ Webhook signature verification failed:`, err.message);
    // As per Stripe docs, return 400 for bad signatures
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // --- [FIX] ---
  // Successfully verified. Now pass the event to the service.
  // The controller's job is done. The service will handle the switch logic.
  try {
    // Call the imported service function
    await handleWebhookService(event);

    // Return a 200 response to Stripe to acknowledge receipt
    res.json({ received: true });

  } catch (error) {
    // Handle any errors from our services
    console.error(`❌ Error handling webhook ${event.id}:`, error);
    // Send a 500 so Stripe knows something went wrong on our end
    res.status(500).json({ message: 'Internal server error processing webhook' });
  }
  // --- [END FIX] ---
};