// ==========================================
// RATE LIMITING: Booking Endpoint Protection
// server/src/middleware/tourBookingRateLimit.js
// ==========================================

// Custom rate limiter specifically for booking endpoint
const bookingAttempts = new Map();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5; // 5 booking attempts per 15 minutes

export const bookingRateLimit = (req, res, next) => {
  const identifier = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!bookingAttempts.has(identifier)) {
    bookingAttempts.set(identifier, { count: 1, resetTime: now + WINDOW_MS });
    return next();
  }

  const attempts = bookingAttempts.get(identifier);

  // Reset if window expired
  if (now > attempts.resetTime) {
    bookingAttempts.set(identifier, { count: 1, resetTime: now + WINDOW_MS });
    return next();
  }

  // Check if limit exceeded
  if (attempts.count >= MAX_ATTEMPTS) {
    return res.status(429).json({
      message: 'Too many booking attempts. Please try again later.',
      retryAfter: Math.ceil((attempts.resetTime - now) / 1000)
    });
  }

  // Increment counter
  attempts.count++;
  next();
};

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [identifier, data] of bookingAttempts.entries()) {
    if (now > data.resetTime) {
      bookingAttempts.delete(identifier);
    }
  }
}, WINDOW_MS);