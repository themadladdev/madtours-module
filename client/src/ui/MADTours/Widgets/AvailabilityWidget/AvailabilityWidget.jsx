// client/src/modules/MADTours/AvailabilityWidget/AvailabilityWidget.jsx
import React, { useState, useEffect } from 'react';
import { getActiveTours } from '../../../../services/public/tourBookingService.js';
import styles from './AvailabilityWidget.module.css';

const AvailabilityWidget = () => {
    const [tours, setTours] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Form state
    const [selectedTour, setSelectedTour] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedGuests, setSelectedGuests] = useState(1);

    // Standard navigation function
    const handleNavigate = (event, path) => {
        event.preventDefault();
        window.history.pushState({}, '', path);
        const navigationEvent = new CustomEvent('route-change');
        window.dispatchEvent(navigationEvent);
    };

    useEffect(() => {
        const loadTours = async () => {
            try {
                setLoading(true);
                setError(null);
                const activeTours = await getActiveTours();
                setTours(activeTours);
                // Set default selected tour if list is not empty
                if (activeTours.length > 0) {
                    setSelectedTour(activeTours[0].id);
                }
            } catch (err) {
                setError(err.message);
                console.error("Failed to load tours:", err);
            } finally {
                setLoading(false);
            }
        };

        // Set default date to today
        setSelectedDate(new Date().toISOString().split('T')[0]);
        loadTours();
    }, []);

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!selectedTour || !selectedDate || !selectedGuests) {
            setError("Please fill out all fields.");
            return;
        }
        
        // Construct the destination path with query parameters
        const path = `/tours/${selectedTour}?date=${selectedDate}&guests=${selectedGuests}`;
        
        // Use our custom navigation handler to go to the (future) detail page
        handleNavigate(event, path);
    };

    return (
        <div className={styles.widgetContainer}>
            <h3 className={styles.widgetTitle}>Book Your Tour</h3>
            <form className={styles.widgetForm} onSubmit={handleSubmit}>
                {error && <p className={styles.errorText}>{error}</p>}
                
                <div className={styles.formGroup}>
                    <label htmlFor="tour-select">Tour</label>
                    <select
                        id="tour-select"
                        className={styles.input}
                        value={selectedTour}
                        onChange={(e) => setSelectedTour(e.target.value)}
                        disabled={loading || tours.length === 0}
                    >
                        {loading ? (
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
                
                <div className={styles.formGroup}>
                    <label htmlFor="tour-date">Date</label>
                    <input
                        id="tour-date"
                        type="date"
                        className={styles.input}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]} // Prevent booking past dates
                    />
                </div>
                
                <div className={styles.formGroup}>
                    <label htmlFor="tour-guests">Guests</label>
                    <input
                        id="tour-guests"
                        type="number"
                        className={styles.input}
                        value={selectedGuests}
                        onChange={(e) => setSelectedGuests(parseInt(e.target.value, 10))}
                        min="1"
                        step="1"
                    />
                </div>
                
                <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={loading || !selectedTour}
                >
                    Check Availability
                </button>
            </form>
        </div>
    );
};

export default AvailabilityWidget;