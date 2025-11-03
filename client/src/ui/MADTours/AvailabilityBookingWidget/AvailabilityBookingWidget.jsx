// client/src/modules/MADTours/AvailabilityBookingWidget/AvailabilityBookingWidget.jsx
import React, { useState, useEffect } from 'react';
import { getActiveTours, getTourAvailability } from '../../../services/public/tourBookingService.js';
import styles from './AvailabilityBookingWidget.module.css';

// --- Calendar Helper Functions ---
const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
};
const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
};
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// ---

const AvailabilityBookingWidget = () => {
    // State for tour selection
    const [tours, setTours] = useState([]);
    const [loadingTours, setLoadingTours] = useState(true);
    const [selectedTourId, setSelectedTourId] = useState('');
    const [selectedTourData, setSelectedTourData] = useState(null); // To store basePrice, etc.
    
    // State for availability
    const [availability, setAvailability] = useState({});
    const [loadingAvailability, setLoadingAvailability] = useState(false);
    const [error, setError] = useState(null);
    
    // State for calendar
    const [currentDate, setCurrentDate] = useState(new Date(2025, 10, 3)); // Default to Nov 3, 2025
    const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth());
    const [currentYear, setCurrentYear] = useState(currentDate.getFullYear());

    // State for user selection
    const [selectedDate, setSelectedDate] = useState(null); // YYYY-MM-DD
    const [selectedTime, setSelectedTime] = useState(null); // HH:MM
    const [guests, setGuests] = useState(1);

    // Standard navigation function
    const handleNavigate = (event, path) => {
        event.preventDefault();
        window.history.pushState({}, '', path);
        const navigationEvent = new CustomEvent('route-change');
        window.dispatchEvent(navigationEvent);
    };

    // Effect 1: Load the list of tours on mount
    useEffect(() => {
        const loadTours = async () => {
            try {
                setLoadingTours(true);
                setError(null);
                const activeTours = await getActiveTours();
                setTours(activeTours);
            } catch (err) {
                setError(err.message);
                console.error("Failed to load tours:", err);
            } finally {
                setLoadingTours(false);
            }
        };
        loadTours();
    }, []);

    // Effect 2: Load availability when a tour, month, year, or guest count changes
    useEffect(() => {
        // Do not fetch if no tour is selected
        if (!selectedTourId) {
            setAvailability({});
            return;
        }

        const loadAvailability = async () => {
            try {
                setLoadingAvailability(true);
                setError(null);
                const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
                
                const availableSlots = await getTourAvailability(selectedTourId, monthStr, guests);
                
                const availabilityMap = availableSlots.reduce((acc, slot) => {
                    const dateKey = slot.date.split('T')[0];
                    if (!acc[dateKey]) acc[dateKey] = [];
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
                setLoadingAvailability(false);
            }
        };

        loadAvailability();
    }, [selectedTourId, currentMonth, currentYear, guests]); // Re-run when these change

    // --- Event Handlers ---

    const handleTourChange = (e) => {
        const tourId = e.target.value;
        setSelectedTourId(tourId);
        
        // Find and store the full tour object
        const tourData = tours.find(t => t.id.toString() === tourId);
        setSelectedTourData(tourData || null);

        // Reset selections
        setSelectedDate(null);
        setSelectedTime(null);
        setAvailability({});
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
            setSelectedTime(null); // Clear time selection
        }
    };
    
    const handleGuestChange = (newGuests) => {
        const g = Math.max(1, parseInt(newGuests, 10) || 1);
        setGuests(g);
        setSelectedDate(null); // Clear selections
        setSelectedTime(null);
    };

    const handleBookingSubmit = (event) => {
        const bookingDetails = {
            tourId: selectedTourId,
            date: selectedDate,
            time: selectedTime,
            guests: guests,
            totalAmount: (parseFloat(selectedTourData.base_price) * guests).toFixed(2)
        };
        sessionStorage.setItem('madtours_booking_details', JSON.stringify(bookingDetails));
        handleNavigate(event, '/tours/book');
    };

    // --- Calendar Grid Generation ---
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const calendarGrid = [];
    
    for (let i = 0; i < firstDay; i++) {
        calendarGrid.push(<div key={`empty-${i}`} className={styles.calendarDayEmpty}></div>);
    }
    
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

    return (
        <div className={styles.widgetContainer}>
            {/* --- Step 1: Tour Selection --- */}
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
                    disabled={loadingTours}
                >
                    <option value="">-- Please select a tour --</option>
                    {loadingTours ? (
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

            {/* --- Step 2: Booking Calendar (Conditional) --- */}
            {selectedTourId && (
                <div className={styles.calendarSection}>
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
                        {calendarGrid}
                    </div>
                    
                    {loadingAvailability && <div className={styles.spinnerSmall}></div>}
                    {error && <p className={styles.errorText}>{error}</p>}

                    {/* Time Slot Selector */}
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
                    
                    {/* Booking Button */}
                    {selectedTime && selectedTourData && (
                        <div className={styles.bookingFooter}>
                            <div className={styles.priceSummary}>
                                <span className={styles.priceLabel}>Total Price</span>
                                <span className={styles.priceValue}>
                                    ${(parseFloat(selectedTourData.base_price) * guests).toFixed(2)}
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
            )}
        </div>
    );
};

export default AvailabilityBookingWidget;