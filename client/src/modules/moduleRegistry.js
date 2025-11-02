// ==========================================
// INTEGRATION: Module Registry
// client/src/modules/moduleRegistry.js (ADD TO EXISTING)
// ==========================================

import BookingCalendar from './TourBooking/BookingCalendar.jsx';

export const moduleRegistry = {
  // ... existing modules
  
  // Tour Booking Module (conditional based on feature flag)
  'tour-booking-calendar': BookingCalendar,
};