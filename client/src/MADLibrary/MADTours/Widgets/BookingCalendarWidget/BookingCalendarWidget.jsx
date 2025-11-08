// client/src/MADLibrary/MADTours/Widgets/BookingCalendarWidget/BookingCalendarWidget.jsx
import React, { useState, useEffect } from 'react';
import { getTourAvailability } from '../../../../services/public/tourBookingService.js';
import styles from './BookingCalendarWidget.module.css';

// --- Import "Dumb" UI Components ---
import DumbBookingCalendar from '../../WidgetComponents/BookingCalendar/BookingCalendar.jsx';
import TimeSlotSelector from '../../WidgetComponents/TimeSlotSelector/TimeSlotSelector.jsx';

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const BookingCalendarWidget = ({ tourId, basePrice, defaultDate, defaultGuests }) => {
    const [availability, setAvailability] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Calendar state
    const [currentDate, setCurrentDate] = useState(defaultDate ? new Date(defaultDate) : new Date(2025, 10, 3)); // Default to Nov 3, 2025
    const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth()); // 10 = November
    const [currentYear, setCurrentYear] = useState(currentDate.getFullYear()); // 2025

    // Selection state
    const [selectedDate, setSelectedDate] = useState(defaultDate); // YYYY-MM-DD
    const [selectedTime, setSelectedTime] = useState(null); // HH:MM
    const [guests, setGuests] = useState(defaultGuests || 1);

    // Standard navigation function
    const handleNavigate = (event, path) => {
        event.preventDefault();
        window.history.pushState({}, '', path);
        const navigationEvent = new CustomEvent('route-change');
        window.dispatchEvent(navigationEvent);
    };

    // Load availability whenever month, year, or guests change
    useEffect(() => {
        const loadAvailability = async () => {
            try {
                setLoading(true);
                setError(null);
                const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
                
                // Call the service
                const availableSlots = await getTourAvailability(tourId, monthStr, guests);
                
                // Re-map the flat array into a hash map for fast lookup
                // { "2025-11-20": [{ time: "09:00", available_seats: 10 }, ...], ... }
                const availabilityMap = availableSlots.reduce((acc, slot) => {
                    const dateKey = slot.date.split('T')[0]; // Format to YYYY-MM-DD
                    if (!acc[dateKey]) {
                        acc[dateKey] = [];
                    }
                    acc[dateKey].push({
                        time: slot.time.substring(0, 5),
                        availableSeats: slot.available_seats
                    });
                    return acc;
                }, {});

                setAvailability(availabilityMap);
            } catch (err) {
                setError(err.message);
                console.error("Failed to load availability:", err);
            } finally {
                setLoading(false);
            }
        };

        loadAvailability();
    }, [tourId, currentMonth, currentYear, guests]);

    const handleMonthChange = (delta) => {
        const newDate = new Date(currentYear, currentMonth + delta, 1);
        setCurrentMonth(newDate.getMonth());
        setCurrentYear(newDate.getFullYear());
        setSelectedDate(null); // Clear selection when changing month
        setSelectedTime(null);
    };

    // This handler now receives just the 'day' number from the dumb component
    const handleDateClick = (day) => {
        const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (availability[dateKey]) {
            setSelectedDate(dateKey);
            setSelectedTime(null); // Clear time selection
        }
    };
    
    const handleGuestChange = (newGuests) => {
        const g = Math.max(1, parseInt(newGuests, 10) || 1);
        setGuests(g);
        setSelectedDate(null); // Clear selection
        setSelectedTime(null);
    };

    const handleBookingSubmit = (event) => {
        // This will navigate to the (future) BookingForm
        const bookingDetails = {
            tourId: tourId,
            date: selectedDate,
            time: selectedTime,
            guests: guests,
            totalAmount: (parseFloat(basePrice) * guests).toFixed(2)
        };
        // Store details in session storage to pass to the next page
        sessionStorage.setItem('madtours_booking_details', JSON.stringify(bookingDetails));
        handleNavigate(event, '/tours/book');
    };

    // --- RENDER ---
    // The logic is now clean. This component fetches data and passes it to "dumb" components.

    return (
        <div className={styles.widgetContainer}>
            <div className={styles.widgetHeader}>
                <h3 className={styles.widgetTitle}>Book This Tour</h3>
                <div className={styles.guestSelector}>
                    <label htmlFor="guests">Guests</label>
                    <input
                        id="guests"
                        type="number"
                        min="1"
                        step="1"
                        value={guests}
                        onChange={(e) => handleGuestChange(e.target.value)}
                        className={styles.guestInput}
                    />
                </div>
            </div>

            {/* --- REFACTORED: Use "Dumb" Calendar --- */}
            {/* This component just displays the grid and bubbles up events */}
            <DumbBookingCalendar
                currentMonth={currentMonth}
                currentYear={currentYear}
                availability={availability}
                selectedDate={selectedDate}
                onDateClick={handleDateClick}
                onMonthChange={handleMonthChange}
            />
            
            {loading && <div className={styles.spinnerSmall}></div>}
            {error && <p className={styles.errorText}>{error}</p>}

            {/* --- REFACTORED: Use "Dumb" Time Slot Selector --- */}
            {selectedDate && availability[selectedDate] && (
                <TimeSlotSelector
                    slots={availability[selectedDate]}
                    selectedTime={selectedTime}
                    onTimeClick={setSelectedTime} // Pass the state setter directly
                />
            )}
            
            {/* --- Booking Button --- */}
            {selectedTime && (
                <div className={styles.bookingFooter}>
                    <div className={styles.priceSummary}>
                        <span className={styles.priceLabel}>Total Price</span>
                        <span className={styles.priceValue}>
                            ${(parseFloat(basePrice) * guests).toFixed(2)}
                        </span>
                    </div>
                    <button 
                        className={styles.bookButton}
                        onClick={handleBookingSubmit}
                    >
                        Book Now
                    </button>
                </div>
            )}
        </div>
    );
};

export default BookingCalendarWidget;