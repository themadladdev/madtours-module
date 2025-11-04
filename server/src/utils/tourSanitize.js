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
    totalAmount: parseFloat(data.totalAmount),
    // --- NEW: Added missing fields from createBooking ---
    tourId: parseInt(data.tourId),
    date: sanitizeInput(data.date), // Dates are strings
    time: sanitizeInput(data.time), // Times are strings
    // --- END NEW ---
  };
};

// --- NEW: Sanitizer for the TicketBookingWidget ---
export const sanitizeTicketBookingData = (data) => {
  // 1. Sanitize simple fields
  const tourId = parseInt(data.tourId);
  const date = sanitizeInput(data.date);
  const time = sanitizeInput(data.time);
  const totalAmount = parseFloat(data.totalAmount);
  const totalSeats = parseInt(data.totalSeats);

  // 2. Sanitize Customer object
  const customer = {
    email: sanitizeInput(data.customer.email).toLowerCase(),
    firstName: sanitizeInput(data.customer.firstName),
    lastName: sanitizeInput(data.customer.lastName),
    phone: sanitizeInput(data.customer.phone),
  };

  // 3. Sanitize Tickets array
  const tickets = data.tickets.map(t => ({
    ticket_id: parseInt(t.ticket_id),
    quantity: parseInt(t.quantity),
  }));

  // 4. Sanitize Passengers array
  const passengers = data.passengers.map(p => ({
    firstName: sanitizeInput(p.firstName),
    lastName: sanitizeInput(p.lastName),
    ticket_type: sanitizeInput(p.ticket_type),
  }));

  return {
    tourId,
    date,
    time,
    totalAmount,
    totalSeats,
    customer,
    tickets,
    passengers,
  };
};
// --- END NEW FUNCTION ---