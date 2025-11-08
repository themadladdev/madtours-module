// ==========================================
// client/src/MADLibrary/MADTours/Widgets/TicketBookingWidget/TicketBookingWidget.jsx
// ==========================================

import React, { useState, useEffect } from 'react';
import * as tourBookingService from '../../../../services/public/tourBookingService.js';
import { useToast } from '../../../admin/toast/useToast.js';
import styles from './TicketBookingWidget.module.css';

// --- Import Reusable Widget Components ---
import BookingCalendar from '../../WidgetComponents/BookingCalendar/BookingCalendar.jsx';
import TimeSlotSelector from '../../WidgetComponents/TimeSlotSelector/TimeSlotSelector.jsx';
import TicketSelector from '../../WidgetComponents/TicketSelector/TicketSelector.jsx';
import CustomerDetailsForm from '../../WidgetComponents/CustomerDetailsForm/CustomerDetailsForm.jsx';
// ---

const TicketBookingWidget = () => {
  // --- State for hooks ---
  const { showToast } = useToast();

  // --- State for data loading ---
  const [tours, setTours] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [availability, setAvailability] = useState({});
  const [loading, setLoading] = useState({ tours: true, availability: false, pricing: false, booking: false });

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
  const [selectedTimeFull, setSelectedTimeFull] = useState(null); // HH:MM:SS
  
  // Ticket selection: { ticket_id: 1, quantity: 2 }
  const [ticketSelection, setTicketSelection] = useState([]);
  
  // Customer (payer) details
  const [customer, setCustomer] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [isPayerAPassenger, setIsPayerAPassenger] = useState(true);

  // --- [NEW] State for customer notes ---
  const [customerNotes, setCustomerNotes] = useState('');

  // --- Calculated values (Unchanged) ---

  const totalSelectedSeats = ticketSelection.reduce((sum, item) => {
    const ticketDef = pricing.find(p => p.ticket_id === item.ticket_id);
    if (!ticketDef) return sum;

    if (ticketDef.ticket_type === 'atomic') {
      return sum + item.quantity;
    } else if (ticketDef.ticket_type === 'combined' && ticketDef.recipe) {
      const seatsInBundle = ticketDef.recipe.reduce((s, comp) => s + comp.quantity, 0);
      return sum + (seatsInBundle * item.quantity);
    }
    return sum;
  }, 0);

  const totalAmount = ticketSelection.reduce((sum, item) => {
    const priceRule = pricing.find(p => p.ticket_id === item.ticket_id);
    return sum + ((priceRule ? parseFloat(priceRule.price) : 0) * item.quantity);
  }, 0);

  const selectedSlot = (selectedDate && availability[selectedDate]?.find(s => s.time === selectedTimeFull)) || null;

  // --- Load all active tours on mount (Unchanged) ---
  useEffect(() => {
    const loadTours = async () => {
      setLoading(p => ({ ...p, tours: true }));
      try {
        const activeTours = await tourBookingService.getActiveTours();
        setTours(activeTours);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setLoading(p => ({ ...p, tours: false }));
      }
    };
    loadTours();
  }, [showToast]);

  // --- Load availability when tour, month, or total seats changes (Unchanged) ---
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
    setSelectedTimeFull(null);
    setTicketSelection([]);
    setPricing([]);
    setCustomerNotes(''); // --- [NEW] Reset notes
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
    setSelectedTimeFull(null);
  };

  const handleDateClick = (day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (availability[dateKey]) {
      setSelectedDate(dateKey);
      setSelectedTime(null);
      setSelectedTimeFull(null);
      setPricing([]);
      setStep(1);
    }
  };

  const handleTimeClick = async (time) => { // time is HH:MM:SS
    const timeShort = time.substring(0, 5); // HH:MM
    
    setSelectedTime(timeShort);
    setSelectedTimeFull(time);
    setLoading(p => ({ ...p, pricing: true }));
    setPricing([]);
    
    try {
      const pricingData = await tourBookingService.getResolvedInstancePricing(
        selectedTourId,
        selectedDate,
        time // Send full HH:MM:SS
      );
      setPricing(pricingData);
      setStep(2);
    } catch (err) {
      showToast(err.message, 'error');
      setStep(1);
    } finally {
      setLoading(p => ({ ...p, pricing: false }));
    }
  };

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
  
  const handleCustomerChange = (e) => {
    const { name, value } = e.target;
    setCustomer(p => ({ ...p, [name]: value }));
  };

  // --- [MODIFIED] Booking Submission ---
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
      totalSeats: totalSelectedSeats,
      customerNotes: customerNotes // --- [NEW] Add notes to payload ---
    };

    console.log('--- DEBUG [CLIENT WIDGET]: Submitting bookingData ---', bookingData);

    try {
      const result = await tourBookingService.createTicketBooking(bookingData);
      console.log("Booking STUB success:", result);
      showToast('Booking submitted! (STUB)', 'success');
      resetSelections();
      
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(p => ({ ...p, booking: false }));
    }
  };

  return (
    <div className={styles.widgetContainer}>
      <div className={styles.widgetHeader}>
        <h3 className={styles.widgetTitle}>Book Your Tour</h3>
      </div>

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
          <BookingCalendar
            currentMonth={currentMonth}
            currentYear={currentYear}
            availability={availability}
            selectedDate={selectedDate}
            onDateClick={handleDateClick}
            onMonthChange={handleMonthChange}
          />
          
          {loading.availability && <div className={styles.spinnerSmall}></div>}
          
          {selectedDate && (
            <TimeSlotSelector
              slots={availability[selectedDate]}
              selectedTime={selectedTime}
              onTimeClick={handleTimeClick}
            />
          )}
          
          {step >= 2 && loading.pricing && (
            <div className={styles.stepContent}>
              <div className={styles.spinnerSmall}></div>
            </div>
          )}

          {step >= 2 && !loading.pricing && (
            <TicketSelector
              pricing={pricing}
              ticketSelection={ticketSelection}
              onTicketChange={handleTicketChange}
              onContinue={() => setStep(3)}
              totalSelectedSeats={totalSelectedSeats}
              availableSeats={selectedSlot ? selectedSlot.availableSeats : 0}
              totalAmount={totalAmount}
            />
          )}

          {/* --- [MODIFIED] Pass new props to form --- */}
          {step >= 3 && (
            <CustomerDetailsForm
              customer={customer}
              onCustomerChange={handleCustomerChange}
              isPayerAPassenger={isPayerAPassenger}
              onPayerToggle={(e) => setIsPayerAPassenger(e.target.checked)}
              customerNotes={customerNotes}
              onCustomerNotesChange={setCustomerNotes}
              onSubmit={handleBookingSubmit}
              totalAmount={totalAmount}
              isLoading={loading.booking}
            />
          )}
        </>
      )}
    </div>
  );
};

export default TicketBookingWidget;