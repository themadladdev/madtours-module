// ==========================================
// SECURITY: Input Sanitization
// server/src/utils/tourSanitize.js
// ==========================================

export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove potential XSS vectors
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim()
    .slice(0, 1000); // Limit length
};

export const sanitizeBookingData = (data) => {
  return {
    email: sanitizeInput(data.email).toLowerCase(),
    firstName: sanitizeInput(data.firstName),
    lastName: sanitizeInput(data.lastName),
    phone: sanitizeInput(data.phone),
    specialRequests: sanitizeInput(data.specialRequests),
    seats: parseInt(data.seats),
    tourInstanceId: parseInt(data.tourInstanceId),
    totalAmount: parseFloat(data.totalAmount)
  };
};