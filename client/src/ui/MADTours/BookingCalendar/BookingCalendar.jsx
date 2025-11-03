// client/src/modules/MADTours/BookingCalendar/BookingCalendar.jsx
import React, { useState, useEffect } from 'react';
import { getTourAvailability } from '../../../services/public/tourBookingService.js';
import styles from './BookingCalendar.module.css';

// Helper to get days in a month for the calendar grid
const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
};

// Helper to get the first day of the week (0=Sun, 1=Mon)
const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
};

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const BookingCalendar = ({ tourId, basePrice, defaultDate, defaultGuests }) => {
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

    // --- Calendar Grid Generation ---
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const calendarGrid = [];
    
    // Add empty cells for the start of the month
    for (let i = 0; i < firstDay; i++) {
        calendarGrid.push(<div key={`empty-${i}`} className={styles.calendarDayEmpty}></div>);
    }
    
    // Add cells for each day
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isAvailable = !!availability[dateKey];
        const isSelected = selectedDate === dateKey;
        
        calendarGrid.push(
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
    // --- End Grid Generation ---

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

            {/* --- Calendar Navigation --- */}
            <div className={styles.monthNavigator}>
                <button onClick={() => handleMonthChange(-1)}>&larr;</button>
                <span className={styles.monthName}>
                    {monthNames[currentMonth]} {currentYear}
                </span>
                <button onClick={() => handleMonthChange(1)}>&rarr;</button>
            </div>
            
            {/* --- Calendar Grid --- */}
            <div className={styles.calendarGrid}>
                <div className={styles.calendarHeader}>Sun</div>
                <div className={styles.calendarHeader}>Mon</div>
                <div className={styles.calendarHeader}>Tue</div>
                <div className={styles.calendarHeader}>Wed</div>
                <div className={styles.calendarHeader}>Thu</div>
                <div className={styles.calendarHeader}>Fri</div>
                <div className={styles.calendarHeader}>Sat</div>
                {calendarGrid}
            </div>
            
            {loading && <div className={styles.spinnerSmall}></div>}
            {error && <p className={styles.errorText}>{error}</p>}

            {/* --- Time Slot Selector --- */}
            {selectedDate && availability[selectedDate] && (
                <div className={styles.timeSlotSection}>
                    <h4 className={styles.timeSlotTitle}>Select a Time for {new Date(selectedDate + 'T00:00:00').toLocaleDateString()}</h4>
                    <div className={styles.timeSlotGrid}>
                        {availability[selectedDate].map(slot => (
                            <button
                                key={slot.time}
                                className={`${styles.timeSlotButton} ${selectedTime === slot.time ? styles.selected : ''}`}
                                onClick={() => setSelectedTime(slot.time)}
                            >
                                <span className={styles.slotTime}>{slot.time}</span>
                                <span className={styles.slotSeats}>{slot.availableSeats} seats</span>
                            </button>
                        ))}
                    </div>
                </div>
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

export default BookingCalendar;