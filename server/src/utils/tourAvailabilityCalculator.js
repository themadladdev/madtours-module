// server/src/utils/tourAvailabilityCalculator.js
import { pool } from '../db/db.js';

/**
 * Generates a consistent map key from a date object and time string.
 * @param {Date} date - The date object. (MUST be a UTC date object)
 *@param {string} time - The time string (e.g., "09:00:00").
 * @returns {string} - A key in "YYYY-MM-DD:HH:MM" format.
 */
const generateDateTimeKey = (date, time) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const [hour, minute] = time.split(':');
  
  return `${year}-${month}-${day}:${hour}:${minute}`;
};

// ==========================================
// === NEW FUNCTION FOR ADMIN OPERATIONS HUB ===
// ==========================================
/**
 * Generates a list of all tour instances (scheduled, cancelled, etc.) 
 * for the admin panel based on "on-demand" rules.
 *
 * This function:
 * 1. Fetches the "Rules" (schedules, booking window) from `tours` & `tour_schedules`.
 * 2. Fetches the "Exceptions" (booked/cancelled tours) from `tour_instances`.
 * 3. Generates an in-memory list of what *should* be running.
 * 4. Merges the Exceptions onto the Rules to create the final list.
 * 5. Applies admin filters (like status).
 *
 * @param {object} options
 * @param {number} options.tourId - The ID of the tour to check.
 * @param {string} options.startDate - The start of the date range (YYYY-MM-DD).
 * @param {string} options.endDate - The end of the date range (YYYY-MM-DD).
 * @param {string} [options.statusFilter] - Optional status to filter by (e.g., "scheduled").
 * @returns {Promise<Array<object>>} - A list of tour instances for the admin panel.
 */
export const getAdminTourInstances = async ({ tourId, startDate, endDate, statusFilter }) => {
  
  // === 1. Fetch the "Rules" (Tour + Schedules) ===
  // FIX: Moved 'ts.active = true' from WHERE to the JOIN condition
  // This ensures we get the tour even if no active schedule exists.
  const rulesResult = await pool.query(
    `SELECT 
      t.id, t.name, t.duration_minutes, t.base_price,
      t.capacity AS default_capacity, 
      t.booking_window_days,
      ts.schedule_config
    FROM tours t
    LEFT JOIN tour_schedules ts ON t.id = ts.tour_id AND ts.active = true
    WHERE t.id = $1`,
    [tourId]
  );

  if (rulesResult.rows.length === 0) {
    // No tour found
    return [];
  }
  
  const tour = rulesResult.rows[0];
  
  // === FIX: Access the nested 'schedule' object within schedule_config ===
  const scheduleConfig = tour.schedule_config;
  const scheduleRules = scheduleConfig ? scheduleConfig.schedule : null;
  // === END FIX ===

  if (!scheduleRules || !scheduleRules.times || !scheduleRules.days_of_week) {
    // This log is correct. It will fire if no active schedule is found.
    console.error(`Tour ${tourId} has invalid or missing schedule config.`);
    return [];
  }
  
  // --- We do NOT check for blackout_ranges in the ADMIN function ---
  // The admin needs to see all exceptions, even on blacked-out days.

  // === 2. Fetch the "Exceptions" (Booked/Cancelled Instances) ===
  const exceptionsResult = await pool.query(
    `SELECT id, date, time, capacity, booked_seats, status, cancellation_reason
     FROM tour_instances
     WHERE tour_id = $1 AND date >= $2 AND date <= $3`,
    [tourId, startDate, endDate]
  );

  // Convert exceptions to a Map for O(1) lookup
  const exceptionsMap = new Map();
  for (const instance of exceptionsResult.rows) {
    
    // --- START BUG FIX: Timezone Mismatch ---
    // `instance.date` is a JS Date object at local midnight (e.g., 2025-11-02 00:00+10:00)
    // We must convert this to a simple "YYYY-MM-DD" string and re-parse it as UTC
    // to match the date object 'd' used in the loop below.
    
    // 1. Get local date parts, ignoring timezone
    const y = instance.date.getFullYear();
    const m = String(instance.date.getMonth() + 1).padStart(2, '0');
    const d_str = String(instance.date.getDate()).padStart(2, '0');
    const localDateStr = `${y}-${m}-${d_str}`;
    
    // 2. Create a new Date object *as if* the local date was UTC
    const utcDate = new Date(`${localDateStr}T00:00:00Z`);
    
    // 3. Use this standardized UTC date to create the key
    const dateKey = generateDateTimeKey(utcDate, instance.time);
    // --- END BUG FIX ---

    exceptionsMap.set(dateKey, instance);
  }

  // === 3. Generate & Merge In-Memory Instance List ===
  
  const instances = [];
  const start = new Date(`${startDate}T00:00:00Z`); // Explicitly UTC
  const end = new Date(`${endDate}T00:00:00Z`);   // Explicitly UTC

  // Iterate through each day in the requested range
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    
    const dayOfWeek = d.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
    const dateString = d.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // --- START BUG FIX: Removed blackout_ranges check ---
    // The admin panel MUST loop through blacked-out days
    // to find the 'cancelled' exceptions.
    // --- END BUG FIX ---

    // === FIX: Use scheduleRules ===
    // Rule: Check if tour runs on this day of the week
    if (!scheduleRules.days_of_week.includes(dayOfWeek)) {
      continue;
    }

    // Rule: Check for hard-coded exception dates (e.g., holidays)
    if (scheduleRules.blackout_dates && scheduleRules.blackout_dates.includes(dateString)) {
      continue;
    }
    
    // This is a valid day for tours. Now, loop through the scheduled times.
    // === FIX: Use scheduleRules ===
    for (const time of scheduleRules.times) {
      // time is "HH:MM"
      const timeWithSeconds = `${time}:00`;
      
      // 'd' is already a correct UTC date object
      const dateKey = generateDateTimeKey(d, timeWithSeconds);
      
      const exception = exceptionsMap.get(dateKey); // <-- This lookup will now succeed

      // --- Determine instance properties by merging rules and exceptions ---
      let capacity = tour.default_capacity;
      let booked_seats = 0;
      let status = 'scheduled';
      let tour_instance_id = null; // null if it doesn't exist in DB yet
      let cancellation_reason = null;

      if (exception) {
        // An exception exists! Override defaults.
        capacity = exception.capacity;
        booked_seats = exception.booked_seats;
        status = exception.status; // <-- This will now be "cancelled"
        tour_instance_id = exception.id;
        cancellation_reason = exception.cancellation_reason;
      }

      // --- Apply Admin Filter ---
      if (statusFilter && status !== statusFilter) {
        continue;
      }
      
      // --- Add to list ---
      instances.push({
        id: tour_instance_id, // This is the tour_instances.id (or null)
        tour_id: tour.id,
        date: dateString,
        time: timeWithSeconds,
        status: status,
        booked_seats: booked_seats,
        capacity: capacity,
        available_seats: capacity - booked_seats,
        cancellation_reason: cancellation_reason,
        base_price: tour.base_price, // Include for price editor
        tour_name: tour.name, // === ADDED for Dashboard view ===
      });
    }
  }

  return instances;
};
// ==========================================
// === END NEW FUNCTION ===
// ==========================================


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
  
  // === FIX: Access the nested 'schedule' object ===
  const scheduleConfig = tour.schedule_config;
  const scheduleRules = scheduleConfig ? scheduleConfig.schedule : null;
  // === END FIX ===
  
  if (!scheduleRules || !scheduleRules.times || !scheduleRules.days_of_week) {
    // Schedule is incomplete or invalid
    console.error(`Tour ${tourId} has invalid or missing schedule config.`);
    return [];
  }
  
  // --- NEW: Pre-parse blackout ranges for efficient lookup ---
  // --- THIS CHECK REMAINS for the public function ---
  const blackoutRanges = (scheduleRules.blackout_ranges || []).map(range => ({
    from: new Date(`${range.from}T00:00:00Z`),
    to: new Date(`${range.to}T00:00:00Z`)
  }));
  // ---

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
    // --- START BUG FIX: Timezone Mismatch ---
    // Apply the same fix as getAdminTourInstances
    const y = instance.date.getFullYear();
    const m = String(instance.date.getMonth() + 1).padStart(2, '0');
    const d_str = String(instance.date.getDate()).padStart(2, '0');
    const localDateStr = `${y}-${m}-${d_str}`;
    const utcDate = new Date(`${localDateStr}T00:00:00Z`);
    const dateKey = generateDateTimeKey(utcDate, instance.time);
    // --- END BUG FIX ---
    
    exceptionsMap.set(dateKey, instance);
  }

  // === 3. Generate & Merge In-Memory Availability ===
  
  const availableTimes = [];
  
  // Calculate the furthest date a user can book
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0); // Normalize to start of day UTC
  
  const maxBookableDate = new Date(today);
  maxBookableDate.setUTCDate(today.getUTCDate() + tour.booking_window_days);

  const start = new Date(`${startDate}T00:00:00Z`); // Explicitly UTC
  const end = new Date(`${endDate}T00:00:00Z`);   // Explicitly UTC

  // Iterate through each day in the requested range
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    
    // Rule: Check against the booking window
    if (d < today || d > maxBookableDate) {
      continue;
    }
    
    // --- NEW: Rule: Check for blackout_ranges (Rule-Level Exception) ---
    // --- THIS CHECK REMAINS for the public function ---
    let isBlackedOut = false;
    for (const range of blackoutRanges) {
      if (d >= range.from && d <= range.to) {
        isBlackedOut = true;
        break;
      }
    }
    if (isBlackedOut) {
      continue; // Skip this entire day
    }
    // ---

    const dayOfWeek = d.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
    const dateString = d.toISOString().split('T')[0]; // YYYY-MM-DD

    // === FIX: Use scheduleRules ===
    // Rule: Check if tour runs on this day of the week
    if (!scheduleRules.days_of_week.includes(dayOfWeek)) {
      continue;
    }

    // Rule: Check for hard-coded exception dates (e.g., holidays)
    // Note: The public one uses 'exceptions', the admin one 'blackout_dates'
    // We should standardize this, but for now, I'll respect the original.
    if (scheduleConfig.exceptions && scheduleConfig.exceptions.includes(dateString)) {
      continue;
    }

    // This is a valid day for tours. Now, loop through the scheduled times.
    // === FIX: Use scheduleRules ===
    for (const time of scheduleRules.times) {
      // time is "HH:MM"
      const timeWithSeconds = `${time}:00`;
      const dateKey = generateDateTimeKey(d, timeWithSeconds); // 'd' is UTC
      
      const exception = exceptionsMap.get(dateKey); // <-- This lookup will now succeed

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

// ================================================================
// === NEW: PUBLIC FUNCTION FOR AVAILABILITY INDICATOR WIDGET ===
// ================================================================
/**
 * Generates a list of *all* tour instances (virtual, booked, cancelled)
 * for a specific day for the public-facing indicator widget.
 *
 * This is a public-safe version of `getAdminTourInstances`.
 * It respects blackouts and only queries active tours.
 *
 * @param {object} options
 * @param {number} options.tourId - The ID of the tour to check.
 * @param {string} options.date - The specific date to check (YYYY-MM-DD).
 * @returns {Promise<Array<object>>} - A list of all tour instances for that day.
 */
export const getPublicInstancesForDate = async ({ tourId, date }) => {
  
  // === 1. Fetch the "Rules" (Tour + Schedules) ===
  const rulesResult = await pool.query(
    `SELECT 
      t.id, t.name,
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
  const scheduleConfig = tour.schedule_config;
  const scheduleRules = scheduleConfig ? scheduleConfig.schedule : null;

  if (!scheduleRules || !scheduleRules.times || !scheduleRules.days_of_week) {
    console.error(`Tour ${tourId} has invalid or missing schedule config.`);
    return [];
  }
  
  // --- Pre-parse blackout ranges for efficient lookup ---
  const blackoutRanges = (scheduleRules.blackout_ranges || []).map(range => ({
    from: new Date(`${range.from}T00:00:00Z`),
    to: new Date(`${range.to}T00:00:00Z`)
  }));

  // === 2. Fetch the "Exceptions" (Booked/Cancelled Instances) ===
  // We only need to fetch exceptions for this *single day*.
  const exceptionsResult = await pool.query(
    `SELECT id, date, time, capacity, booked_seats, status, cancellation_reason
     FROM tour_instances
     WHERE tour_id = $1 AND date = $2`,
    [tourId, date]
  );

  // Convert exceptions to a Map for O(1) lookup
  const exceptionsMap = new Map();
  for (const instance of exceptionsResult.rows) {
    const y = instance.date.getFullYear();
    const m = String(instance.date.getMonth() + 1).padStart(2, '0');
    const d_str = String(instance.date.getDate()).padStart(2, '0');
    const localDateStr = `${y}-${m}-${d_str}`;
    const utcDate = new Date(`${localDateStr}T00:00:00Z`);
    const dateKey = generateDateTimeKey(utcDate, instance.time);
    exceptionsMap.set(dateKey, instance);
  }

  // === 3. Generate & Merge In-Memory Instance List ===
  
  const instances = [];
  const d = new Date(`${date}T00:00:00Z`); // Explicitly UTC

  // Rule: Check for blackout_ranges (Rule-Level Exception)
  let isBlackedOut = false;
  for (const range of blackoutRanges) {
    if (d >= range.from && d <= range.to) {
      isBlackedOut = true;
      break;
    }
  }
  // If the whole day is blacked out, we can just return the exceptions
  // that are 'cancelled' (which is what the loop will do anyway).
  // But if it's blacked out, we shouldn't show 'scheduled' tours.
  if (isBlackedOut) {
    // Return only the *exceptions* for this day, which will be 'cancelled'
    // This correctly shows 'Cancelled' for all times.
    return exceptionsResult.rows.map(ex => ({
        id: ex.id,
        tour_id: tour.id,
        date: date,
        time: ex.time,
        status: ex.status,
        booked_seats: ex.booked_seats,
        capacity: ex.capacity,
        available_seats: ex.capacity - ex.booked_seats,
        cancellation_reason: ex.cancellation_reason
    })).sort((a,b) => a.time.localeCompare(b.time));
  }

  const dayOfWeek = d.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
  const dateString = d.toISOString().split('T')[0]; // YYYY-MM-DD

  // Rule: Check if tour runs on this day of the week
  if (!scheduleRules.days_of_week.includes(dayOfWeek)) {
    return []; // No tours run this day
  }

  // Rule: Check for hard-coded exception dates (e.g., holidays)
  if (scheduleRules.blackout_dates && scheduleRules.blackout_dates.includes(dateString)) {
    return []; // No tours run this day
  }
  
  // This is a valid day for tours. Loop through the scheduled times.
  for (const time of scheduleRules.times) {
    const timeWithSeconds = `${time}:00`;
    const dateKey = generateDateTimeKey(d, timeWithSeconds);
    const exception = exceptionsMap.get(dateKey);

    let capacity = tour.default_capacity;
    let booked_seats = 0;
    let status = 'scheduled';
    let tour_instance_id = null;
    let cancellation_reason = null;

    if (exception) {
      // An exception exists! Override defaults.
      capacity = exception.capacity;
      booked_seats = exception.booked_seats;
      status = exception.status;
      tour_instance_id = exception.id;
      cancellation_reason = exception.cancellation_reason;
    }
    
    // Add to list regardless of status (Available, Sold Out, Cancelled)
    instances.push({
      id: tour_instance_id,
      tour_id: tour.id,
      date: dateString,
      time: timeWithSeconds,
      status: status,
      booked_seats: booked_seats,
      capacity: capacity,
      available_seats: capacity - booked_seats,
      cancellation_reason: cancellation_reason,
    });
  }

  return instances; // Already sorted by time
};