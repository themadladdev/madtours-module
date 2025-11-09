// client/src/MADLibrary/MADTours/Widgets/AdminBookingWidget/AdminBookingWidget.jsx
import React, { useState, useEffect } from 'react';
import { useToast } from '../../../admin/toast/useToast.js';
import styles from './AdminBookingWidget.module.css'; // Use its own CSS file

// --- Import Admin Service Functions ---
import { getAllTours, getTourInstances } from '../../../../services/admin/adminTourService.js';
import { createManualBooking, createFocBooking } from '../../../../services/admin/adminBookingService.js';

// --- Import Public Service Function (as provided) ---
import { getResolvedInstancePricing } from '../../../../services/public/tourBookingService.js';

// --- Import Reusable Widget Components ---
import BookingCalendar from '../../WidgetComponents/BookingCalendar/BookingCalendar.jsx';
import TimeSlotSelector from '../../WidgetComponents/TimeSlotSelector/TimeSlotSelector.jsx';
import TicketSelector from '../../WidgetComponents/TicketSelector/TicketSelector.jsx';

// --- [FIX] Import from correct WidgetComponents location ---
import AdminCustomerDetails from '../../WidgetComponents/AdminCustomerDetails/AdminCustomerDetails.jsx';

const AdminBookingWidget = ({ initialTourId, initialDate, initialTime, onBookingSuccess, onClose }) => {
  // --- State for hooks ---
  const { showToast } = useToast();

  // --- State for data loading ---
  const [tours, setTours] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [availability, setAvailability] = useState({});
  const [loading, setLoading] = useState({ tours: true, availability: false, pricing: false, booking: false });

  // --- State for calendar ---
  const [currentDate, setCurrentDate] = useState(new Date(2025, 10, 3)); // Default
  const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth());
  const [currentYear, setCurrentYear] = useState(currentDate.getFullYear());

  // --- State for user selections ---
  const [step, setStep] = useState(1); // 1: Date/Time, 2: Tickets, 3: Details
  const [selectedTourId, setSelectedTourId] = useState(initialTourId || '');
  const [selectedDate, setSelectedDate] = useState(initialDate || null); // YYYY-MM-DD
  const [selectedTime, setSelectedTime] = useState(initialTime ? initialTime.substring(0, 5) : null); // HH:MM
  const [selectedTimeFull, setSelectedTimeFull] = useState(initialTime || null); // HH:MM:SS
  
  const [ticketSelection, setTicketSelection] = useState([]);
  
  // --- Admin-specific state for final step ---
  const [customer, setCustomer] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [customerNotes, setCustomerNotes] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [paymentOption, setPaymentOption] = useState('payment_manual_pending');

  // --- Calculated values ---
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

  // --- Load all tours on mount ---
  useEffect(() => {
    const loadTours = async () => {
      setLoading(p => ({ ...p, tours: true }));
      try {
        const activeTours = await getAllTours(true); 
        setTours(activeTours);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setLoading(p => ({ ...p, tours: false }));
      }
    };
    loadTours();
  }, [showToast]);

  // --- Load availability when tour or month changes ---
  useEffect(() => {
    if (!selectedTourId) {
      setAvailability({});
      return;
    }
    const loadAvailability = async () => {
      setLoading(p => ({ ...p, availability: true }));
      try {
        const startDate = new Date(currentYear, currentMonth, 1);
        const endDate = new Date(currentYear, currentMonth + 1, 0);
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        const instances = await getTourInstances({
          tour_id: selectedTourId,
          startDate: startDateStr,
          endDate: endDateStr
        });
        //

        const availabilityMap = instances.reduce((acc, instance) => {
            if (instance.status !== 'scheduled') {
                return acc;
            }
            const dateKey = instance.date.split('T')[0];
            if (!acc[dateKey]) acc[dateKey] = [];
            
            const availableSeats = instance.capacity - instance.booked_seats;
            
            if (availableSeats >= (totalSelectedSeats || 1)) {
                acc[dateKey].push({
                    time: instance.time, // HH:MM:SS
                    availableSeats: availableSeats
                });
            }
            return acc;
        }, {});

        setAvailability(availabilityMap);
      } catch (err) {
        console.error("Error in loadAvailability:", err);
        showToast(err.message, 'error');
      } finally {
        setLoading(p => ({ ...p, availability: false }));
      }
    };
    
    loadAvailability();
  }, [selectedTourId, currentMonth, currentYear, totalSelectedSeats, showToast]);

  // --- Handle pre-filled data ---
  useEffect(() => {
    if (initialTourId && initialDate && initialTime) {
      handleTimeClick(initialTime);
      setStep(2); 
    }
  }, [initialTourId, initialDate, initialTime]);


  // --- Event Handlers ---

  const resetSelections = () => {
    setStep(1);
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedTimeFull(null);
    setTicketSelection([]);
    setPricing([]);
    setCustomerNotes('');
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
      const pricingData = await getResolvedInstancePricing(
        selectedTourId,
        selectedDate,
        time // Send full HH:MM:SS
      );
      //
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

  // --- [ADMIN] Booking Submission ---
  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setLoading(p => ({ ...p, booking: true }));

    let passengerList = [
        { 
            firstName: customer.firstName, 
            lastName: customer.lastName, 
            ticket_type: "Adult" // Admin Default
        }
    ];

    const bookingData = {
      tourId: selectedTourId,
      date: selectedDate,
      time: selectedTime, // Send HH:MM
      customer: customer,
      tickets: ticketSelection,
      passengers: passengerList, 
      totalAmount: totalAmount, // Start with calculated amount
      totalSeats: totalSelectedSeats,
      customerNotes: customerNotes
    };

    try {
      //
      if (paymentOption === 'payment_foc') {
        
        // --- [FIX] ---
        // Explicitly set totalAmount to 0 for FOC bookings.
        bookingData.totalAmount = 0.00;
        // --- [END FIX] ---

        // --- Call Origin 3 Endpoint ---
        await createFocBooking(bookingData, adminNotes);
        showToast('FOC Booking Created', 'success');
      } else {
        // --- Call Origin 2 Endpoint ---
        // This will use the calculated totalAmount, which is correct
        // for 'payment_manual_pending'
        await createManualBooking(bookingData);
        showToast('Manual Booking Created', 'success');
      }
      
      onBookingSuccess(); // Call parent prop to refresh/close
      
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(p => ({ ...p, booking: false }));
    }
  };

  return (
    <div className={styles.widgetContainer}>
      
      {/* --- Step 1: Tour (if not pre-filled) --- */}
      {!initialTourId && (
         <div className={styles.tourSelectorGroup} style={{ borderBottom: '1px solid var(--border-color)'}}>
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
      )}

      {selectedTourId && (
        <>
          {/* --- Step 1: Calendar (if not pre-filled) --- */}
          {!initialDate && (
             <BookingCalendar
                currentMonth={currentMonth}
                currentYear={currentYear}
                availability={availability}
                selectedDate={selectedDate}
                onDateClick={handleDateClick}
                onMonthChange={handleMonthChange}
            />
          )}
          
          {loading.availability && <div className={styles.spinnerSmall}></div>}
          
          {/* --- Step 1: Time (if not pre-filled) --- */}
          {selectedDate && !initialTime && (
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

          {/* --- Step 2: Tickets --- */}
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

          {/* --- Step 3: Admin Details & Submit --- */}
          {step >= 3 && (
            <AdminCustomerDetails
              customer={customer}
              onCustomerChange={handleCustomerChange}
              customerNotes={customerNotes}
              onCustomerNotesChange={setCustomerNotes}
              adminNotes={adminNotes}
              onAdminNotesChange={setAdminNotes}
              paymentOption={paymentOption}
              onPaymentOptionChange={setPaymentOption}
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

export default AdminBookingWidget;