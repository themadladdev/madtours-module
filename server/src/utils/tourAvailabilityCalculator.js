import { pool } from '../db/db.js';

/**
 * Generates a consistent map key from a date object and time string.
 * @param {Date} date - The date object.
 * @param {string} time - The time string (e.g., "09:00:00").
 * @returns {string} - A key in "YYYY-MM-DD:HH:MM" format.
 */
const generateDateTimeKey = (date, time) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const [hour, minute] = time.split(':');
  
  return `${year}-${month}-${day}:${hour}:${minute}`;
};

/**
 * Generates a list of available tour times based on "on-demand" rules
 * ("Just-in-Time" scheduling).
 *
 * This function:
 * 1. Fetches the "Rules" (schedules, booking window) from `tours` & `tour_schedules`.
 * 2. Fetches the "Exceptions" (booked/cancelled tours) from `tour_instances`.
 * 3. Generates an in-memory list of what *should* be available.
 * 4. Merges the Exceptions onto the Rules to create the final list.
 *
 * @param {object} options
 * @param {number} options.tourId - The ID of the tour to check.
 * @param {string} options.startDate - The start of the date range (YYYY-MM-DD).
 * @param {string} options.endDate - The end of the date range (YYYY-MM-DD).
 * @param {number} [options.seats=1] - The number of seats requested.
 * @returns {Promise<Array<object>>} - A list of available tour time slots.
 */
export const getAvailableTimes = async ({ tourId, startDate, endDate, seats = 1 }) => {
  
  // === 1. Fetch the "Rules" (Tour + Schedules) ===
  const rulesResult = await pool.query(
    `SELECT 
      t.id, t.name, t.duration_minutes, t.base_price,
      t.capacity AS default_capacity, 
      t.booking_window_days,
      ts.schedule_config
    FROM tours t
    LEFT JOIN tour_schedules ts ON t.id = ts.tour_id
    WHERE t.id = $1 AND t.active = true AND ts.active = true`,
    [tourId]
  );

  if (rulesResult.rows.length === 0) {
    // No active tour or no active schedule found
    return [];
  }
  
  const tour = rulesResult.rows[0];
  const schedule = tour.schedule_config; // The JSONB rules
  
  if (!schedule || !schedule.times || !schedule.days_of_week) {
    // Schedule is incomplete or invalid
    console.error(`Tour ${tourId} has invalid or missing schedule config.`);
    return [];
  }

  // === 2. Fetch the "Exceptions" (Booked/Cancelled Instances) ===
  const exceptionsResult = await pool.query(
    `SELECT id, date, time, capacity, booked_seats, status
     FROM tour_instances
     WHERE tour_id = $1 AND date >= $2 AND date <= $3`,
    [tourId, startDate, endDate]
  );

  // Convert exceptions to a Map for O(1) lookup
  const exceptionsMap = new Map();
  for (const instance of exceptionsResult.rows) {
    // Dates are stored as YYYY-MM-DD in DB, times as HH:MM:SS
    const dateKey = generateDateTimeKey(new Date(instance.date), instance.time);
    exceptionsMap.set(dateKey, instance);
  }

  // === 3. Generate & Merge In-Memory Availability ===
  
  const availableTimes = [];
  
  // Calculate the furthest date a user can book
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0); // Normalize to start of day UTC
  
  const maxBookableDate = new Date(today);
  maxBookableDate.setUTCDate(today.getUTCDate() + tour.booking_window_days);

  const start = new Date(`${startDate}T00:00:00Z`); // Assume UTC
  const end = new Date(`${endDate}T00:00:00Z`);   // Assume UTC

  // Iterate through each day in the requested range
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    
    // Rule: Check against the booking window
    if (d < today || d > maxBookableDate) {
      continue;
    }

    const dayOfWeek = d.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
    const dateString = d.toISOString().split('T')[0]; // YYYY-MM-DD

    // Rule: Check if tour runs on this day of the week
    if (!schedule.days_of_week.includes(dayOfWeek)) {
      continue;
    }

    // Rule: Check for hard-coded exception dates (e.g., holidays)
    if (schedule.exceptions && schedule.exceptions.includes(dateString)) {
      continue;
    }

    // This is a valid day for tours. Now, loop through the scheduled times.
    for (const time of schedule.times) {
      // time is "HH:MM"
      const timeWithSeconds = `${time}:00`;
      const dateKey = generateDateTimeKey(d, timeWithSeconds);
      
      const exception = exceptionsMap.get(dateKey);

      let capacity = tour.default_capacity;
      let booked_seats = 0;
      let status = 'scheduled';
      let tour_instance_id = null; // null if it doesn't exist yet

      if (exception) {
        // An exception exists! Override defaults.
        capacity = exception.capacity;
        booked_seats = exception.booked_seats;
        status = exception.status;
        tour_instance_id = exception.id;
      }

      // Final check: Is it bookable?
      const available_seats = capacity - booked_seats;
      const canBook = status === 'scheduled' && available_seats >= seats;

      if (canBook) {
        availableTimes.push({
          tour_instance_id, // Will be null if not yet created
          tour_id: tour.id,
          date: dateString,
          time: timeWithSeconds,
          capacity: capacity,
          booked_seats: booked_seats,
          available_seats: available_seats,
          name: tour.name,
          base_price: tour.base_price,
          duration_minutes: tour.duration_minutes
        });
      }
    }
  }

  return availableTimes;
};