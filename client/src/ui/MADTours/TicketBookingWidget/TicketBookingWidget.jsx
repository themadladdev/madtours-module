// client/src/ui/MADTours/TicketBookingWidget/TicketBookingWidget.jsx
import React, { useState, useEffect } from 'react';
import * as tourBookingService from '../../../services/public/tourBookingService.js';
// --- NEW: Import the toast hook ---
import { useToast } from '../../toast/useToast.js';
import styles from './TicketBookingWidget.module.css';

// --- Calendar Helper Functions ---
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// ---

const TicketBookingWidget = () => {
  // --- NEW: Use toast hook for errors ---
  const { showToast } = useToast();

  // --- State for data loading ---
  const [tours, setTours] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [availability, setAvailability] = useState({});
  const [loading, setLoading] = useState({ tours: true, availability: false, pricing: false, booking: false });
  // --- REMOVED: error state ---
  // const [error, setError] = useState(null);

  // --- State for tour selection ---
  const [selectedTourId, setSelectedTourId] = useState('');
  
  // --- State for calendar ---
  const [currentDate, setCurrentDate] = useState(new Date(2025, 10, 3)); // Default to Nov 3, 2025
  const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth());
  const [currentYear, setCurrentYear] = useState(currentDate.getFullYear());

  // --- State for user selections ---
  const [step, setStep] = useState(1); // 1: Date/Time, 2: Tickets, 3: Details
  const [selectedDate, setSelectedDate] = useState(null); // YYYY-MM-DD
  const [selectedTime, setSelectedTime] = useState(null); // HH:MM
  
  // Ticket selection: { ticket_id: 1, quantity: 2 }
  const [ticketSelection, setTicketSelection] = useState([]);
  
  // Customer (payer) details
  const [customer, setCustomer] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [isPayerAPassenger, setIsPayerAPassenger] = useState(true);

  // --- Calculated values ---

  const totalSelectedSeats = ticketSelection.reduce((sum, item) => {
    const ticketDef = pricing.find(p => p.ticket_id === item.ticket_id);
    if (!ticketDef) return sum;

    // --- BUG FIX: Check for 'ticket_type' (from API) not 'type' ---
    if (ticketDef.ticket_type === 'atomic') {
      return sum + item.quantity;
    } else if (ticketDef.ticket_type === 'combined' && ticketDef.recipe) {
      const seatsInBundle = ticketDef.recipe.reduce((s, comp) => s + comp.quantity, 0);
      return sum + (seatsInBundle * item.quantity);
    }
    // --- END BUG FIX ---
    return sum;
  }, 0);

  const totalAmount = ticketSelection.reduce((sum, item) => {
    const priceRule = pricing.find(p => p.ticket_id === item.ticket_id);
    // --- UPDATED: Use 'price' field, which is now the resolved price ---
    return sum + ((priceRule ? parseFloat(priceRule.price) : 0) * item.quantity);
  }, 0);

  const selectedSlot = (selectedDate && availability[selectedDate]?.find(s => s.time.substring(0, 5) === selectedTime)) || null;

  // --- Load all active tours on mount ---
  useEffect(() => {
    const loadTours = async () => {
      setLoading(p => ({ ...p, tours: true }));
      try {
        const activeTours = await tourBookingService.getActiveTours();
        setTours(activeTours);
      } catch (err) {
        // --- UPDATED: Use toast ---
        showToast(err.message, 'error');
      } finally {
        setLoading(p => ({ ...p, tours: false }));
      }
    };
    loadTours();
  }, []); // showToast is stable, no need to add as dependency

  // --- Load availability when tour, month, or total seats changes ---
  useEffect(() => {
    if (!selectedTourId) {
      setAvailability({});
      return;
    }
    const loadAvailability = async () => {
      setLoading(p => ({ ...p, availability: true }));
      try {
        const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const availableSlots = await tourBookingService.getTourAvailability(
          selectedTourId,
          monthStr,
          totalSelectedSeats || 1 // Always check for at least 1 seat
        );
        const availabilityMap = availableSlots.reduce((acc, slot) => {
          const dateKey = slot.date.split('T')[0];
          if (!acc[dateKey]) acc[dateKey] = [];
          acc[dateKey].push({
            time: slot.time, // e.g., "09:00:00"
            availableSeats: slot.available_seats
          });
          return acc;
        }, {});
        setAvailability(availabilityMap);
      } catch (err) {
        // --- UPDATED: Use toast ---
        showToast(err.message, 'error');
      } finally {
        setLoading(p => ({ ...p, availability: false }));
      }
    };
    
    loadAvailability();
  }, [selectedTourId, currentMonth, currentYear, totalSelectedSeats, showToast]);

  // --- Event Handlers ---

  const resetSelections = () => {
    setStep(1);
    setSelectedDate(null);
    setSelectedTime(null);
    setTicketSelection([]);
    setPricing([]); // Clear pricing
  };

  const handleTourChange = (e) => {
    setSelectedTourId(e.target.value);
    resetSelections();
  };

  const handleMonthChange = (delta) => {
    const newDate = new Date(currentYear, currentMonth + delta, 1);
    setCurrentMonth(newDate.getMonth());
    setCurrentYear(newDate.getFullYear());
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const handleDateClick = (day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (availability[dateKey]) {
      setSelectedDate(dateKey);
      setSelectedTime(null);
      setPricing([]); // Clear pricing if new date is selected
      setStep(1); // Go back to step 1
    }
  };

  // --- UPDATED: Fetches pricing on time selection ---
  const handleTimeClick = async (time) => { // time is HH:MM:SS
    const timeShort = time.substring(0, 5); // HH:MM
    
    setSelectedTime(timeShort);
    setLoading(p => ({ ...p, pricing: true })); // Set loading
    setPricing([]); // Clear old pricing
    
    try {
      // Call the new service function
      const pricingData = await tourBookingService.getResolvedInstancePricing(
        selectedTourId,
        selectedDate,
        time // Send full HH:MM:SS
      );
      setPricing(pricingData); // Set new pricing
      setStep(2); // Move to ticket selection
    } catch (err) {
      // --- UPDATED: Use toast ---
      showToast(err.message, 'error');
      setStep(1); // Stay on step 1 if pricing fails
    } finally {
      setLoading(p => ({ ...p, pricing: false }));
    }
  };
  // --- END UPDATE ---

  const handleTicketChange = (ticket_id, quantity) => {
    const qty = Math.max(0, parseInt(quantity, 10) || 0);
    let newSelection = [...ticketSelection];
    const existing = newSelection.find(item => item.ticket_id === ticket_id);
    
    if (existing) {
      existing.quantity = qty;
    } else {
      newSelection.push({ ticket_id, quantity: qty });
    }
    
    newSelection = newSelection.filter(item => item.quantity > 0);
    setTicketSelection(newSelection);
  };

  // --- Customer Form ---
  
  const handleCustomerChange = (e) => {
    const { name, value } = e.target;
    setCustomer(p => ({ ...p, [name]: value }));
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setLoading(p => ({ ...p, booking: true }));

    let passengerList = [];
    if (isPayerAPassenger) {
      passengerList.push({
        firstName: customer.firstName,
        lastName: customer.lastName,
        ticket_type: "Payer" 
      });
    }

    const bookingData = {
      tourId: selectedTourId,
      date: selectedDate,
      time: selectedTime, // Send HH:MM
      customer: customer,
      tickets: ticketSelection,
      passengers: passengerList, 
      totalAmount: totalAmount,
      totalSeats: totalSelectedSeats 
    };

    // --- DEBUG [1/3] ---
    console.log('--- DEBUG [CLIENT WIDGET]: Submitting bookingData ---', bookingData);
    // --- END DEBUG ---

    try {
      const result = await tourBookingService.createTicketBooking(bookingData);
      console.log("Booking STUB success:", result);
      // --- UPDATED: Use toast ---
      showToast('Booking submitted! (STUB)', 'success');
      resetSelections();
      
    } catch (err) {
      // --- UPDATED: Use toast ---
      showToast(err.message, 'error');
    } finally {
      setLoading(p => ({ ...p, booking: false }));
    }
  };

  // --- Render Functions ---

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const grid = [];
    for (let i = 0; i < firstDay; i++) grid.push(<div key={`empty-${i}`} className={styles.calendarDayEmpty}></div>);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isAvailable = !!availability[dateKey];
      const isSelected = selectedDate === dateKey;
      grid.push(
        <button
          key={`day-${day}`}
          className={`${styles.calendarDay} ${isAvailable ? styles.available : ''} ${isSelected ? styles.selected : ''}`}
          onClick={() => handleDateClick(day)}
          disabled={!isAvailable}
        >
          {day}
        </button>
      );
    }
    return grid;
  };

  const renderTimeSlots = () => {
    if (!selectedDate || !availability[selectedDate]) return null;
    return (
      <div className={styles.stepContent}>
        <h4 className={styles.stepTitle}>Select a Time</h4>
        <div className={styles.timeSlotGrid}>
          {availability[selectedDate].map(slot => (
            <button
              key={slot.time}
              // --- UPDATED: Pass full HH:MM:SS to handler ---
              className={`${styles.timeSlotButton} ${selectedTime === slot.time.substring(0, 5) ? styles.selected : ''}`}
              onClick={() => handleTimeClick(slot.time)}
            >
              <span className={styles.slotTime}>{slot.time.substring(0, 5)}</span>
              <span className={styles.slotSeats}>{slot.availableSeats} seats</span>
            </button>
          ))}
        </div>
      </div>
    );
  };
  
  const renderTicketSelection = () => {
    if (step < 2) return null;

    if (loading.pricing) {
      return (
        <div className={styles.stepContent}>
          <div className={styles.spinnerSmall}></div>
        </div>
      );
    }

    const availableSeats = selectedSlot ? selectedSlot.availableSeats : 0;

    return (
      <div className={styles.stepContent}>
        <div className={styles.stepHeader}>
          <h4 className={styles.stepTitle}>Select Tickets</h4>
          <span className={styles.availability}>
            {totalSelectedSeats} / {availableSeats} seats
          </span>
        </div>
        
        {pricing.map(ticket => (
          <div key={ticket.ticket_id} className={styles.ticketRow}>
            <div className={styles.ticketInfo}>
              <span className={styles.ticketName}>{ticket.ticket_name}</span>
              {/* --- UPDATED: Parse price as float for .toFixed --- */}
              <span className={styles.ticketPrice}>${parseFloat(ticket.price).toFixed(2)}</span>
            </div>
            <input
              type="number"
              min="0"
              step="1"
              className={styles.ticketInput}
              value={ticketSelection.find(t => t.ticket_id === ticket.ticket_id)?.quantity || 0}
              onChange={(e) => handleTicketChange(ticket.ticket_id, e.target.value)}
            />
          </div>
        ))}
        
        {totalSelectedSeats > 0 && (
          <button 
            className={styles.bookButton} 
            onClick={() => setStep(3)}
            disabled={totalSelectedSeats > availableSeats}
          >
            {totalSelectedSeats > availableSeats ? 'Not Enough Seats' : `Continue ($${totalAmount.toFixed(2)})`}
          </button>
        )}
      </div>
    );
  };

  const renderCustomerDetails = () => {
    if (step < 3) return null;
    return (
      <div className={styles.stepContent}>
        <h4 className={styles.stepTitle}>Your Details</h4>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label>First Name</label>
            <input type="text" name="firstName" value={customer.firstName} onChange={handleCustomerChange} className={styles.input} required />
          </div>
          <div className={styles.formGroup}>
            <label>Last Name</label>
            <input type="text" name="lastName" value={customer.lastName} onChange={handleCustomerChange} className={styles.input} required />
          </div>
          <div className={styles.formGroup}>
            <label>Email</label>
            <input type="email" name="email" value={customer.email} onChange={handleCustomerChange} className={styles.input} required />
          </div>
          <div className={styles.formGroup}>
            <label>Phone</label>
            <input type="tel" name="phone" value={customer.phone} onChange={handleCustomerChange} className={styles.input} required />
          </div>
        </div>

        <div className={styles.checkboxGroup}>
          <input
            type="checkbox"
            id="isPayerAPassenger"
            checked={isPayerAPassenger}
            onChange={(e) => setIsPayerAPassenger(e.target.checked)}
          />
          <label htmlFor="isPayerAPassenger">I am one of the passengers</label>
        </div>

        <button 
          className={styles.bookButton} 
          onClick={handleBookingSubmit}
          disabled={loading.booking}
        >
          {loading.booking ? 'Processing...' : `Confirm Booking ($${totalAmount.toFixed(2)})`}
        </button>
      </div>
    );
  };

  return (
    <div className={styles.widgetContainer}>
      <div className={styles.widgetHeader}>
        <h3 className={styles.widgetTitle}>Book Your Tour</h3>
      </div>
      
      {/* --- REMOVED: Inline error message --- */}
      {/* {error && <p className={styles.errorText}>{error}</p>} */}

      <div className={styles.tourSelectorGroup}>
        <label htmlFor="tour-select">Select a Tour</label>
        <select
          id="tour-select"
          className={styles.input}
          value={selectedTourId}
          onChange={handleTourChange}
          disabled={loading.tours}
        >
          <option value="">-- Please select a tour --</option>
          {loading.tours ? (
            <option>Loading tours...</option>
          ) : (
            tours.map(tour => (
              <option key={tour.id} value={tour.id}>
                {tour.name}
              </option>
            ))
          )}
        </select>
      </div>

      {selectedTourId && (
        <>
          <div className={styles.calendarSection}>
            <div className={styles.monthNavigator}>
              <button onClick={() => handleMonthChange(-1)}>&larr;</button>
              <span className={styles.monthName}>
                {monthNames[currentMonth]} {currentYear}
              </span>
              <button onClick={() => handleMonthChange(1)}>&rarr;</button>
            </div>
            
            <div className={styles.calendarGrid}>
              <div className={styles.calendarHeader}>Sun</div>
              <div className={styles.calendarHeader}>Mon</div>
              <div className={styles.calendarHeader}>Tue</div>
              <div className={styles.calendarHeader}>Wed</div>
              <div className={styles.calendarHeader}>Thu</div>
              <div className={styles.calendarHeader}>Fri</div>
              <div className={styles.calendarHeader}>Sat</div>
              {renderCalendar()}
            </div>
            
            {loading.availability && <div className={styles.spinnerSmall}></div>}
          </div>
          
          {renderTimeSlots()}
          
          {renderTicketSelection()}

          {renderCustomerDetails()}
        </>
      )}
    </div>
  );
};

export default TicketBookingWidget;