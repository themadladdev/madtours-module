// client/src/ui/MADTours/AvailabilityIndicatorWidget/AvailabilityIndicatorWidget.jsx
import React, { useState, useEffect } from 'react';
import styles from './AvailabilityIndicatorWidget.module.css';

// --- Prototype Configuration ---
const PROTOTYPE_TOUR_ID = 3;

// Get today's date in YYYY-MM-DD format
const getToday = () => {
    return new Date().toISOString().split('T')[0];
};

// --- Helper to format date for display ---
const formatDisplayDate = (dateString) => {
    // Use T00:00:00 to ensure the date is parsed in the local timezone
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleString(undefined, {
        weekday: 'short',
        month: 'long',
        day: 'numeric',
    });
};

const AvailabilityIndicatorWidget = () => {
    const [date, setDate] = useState(getToday());
    const [instances, setInstances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tourName, setTourName] = useState('Daily Availability');

    // --- Effect to fetch the tour's name (runs once) ---
    useEffect(() => {
        const fetchTourName = async () => {
            try {
                const API_URL = import.meta.env.VITE_API_URL;
                const endpoint = `/tours/${PROTOTYPE_TOUR_ID}`;
                const response = await fetch(`${API_URL}${endpoint}`);

                if (!response.ok) {
                    throw new Error('Could not fetch tour details');
                }

                const tourData = await response.json();
                setTourName(tourData.name); // Set the tour's actual name

            } catch (err) {
                console.error("Error fetching tour name:", err);
            }
        };

        fetchTourName();
    }, []); // Empty dependency array so it only runs once on mount

    // --- Effect to fetch instances (runs when date changes) ---
    useEffect(() => {
        const fetchInstances = async () => {
            setLoading(true);
            setError(null);
            setInstances([]);

            try {
                const API_URL = import.meta.env.VITE_API_URL;
                const endpoint = `/tours/${PROTOTYPE_TOUR_ID}/instances?date=${date}`;
                const response = await fetch(`${API_URL}${endpoint}`);

                if (!response.ok) {
                    let errorData = { message: `Error ${response.status}: ${response.statusText}` };
                    try {
                        errorData = await response.json();
                    } catch (jsonError) {
                        // Response was not JSON
                    }
                    throw new Error(errorData.message);
                }

                const data = await response.json();
                setInstances(data);

            } catch (err) { // --- SYNTAX FIX HERE ---
                console.error("Error fetching tour instances:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchInstances();
    }, [date]); // Re-run effect when date changes

    // --- Date adjustment logic ---
    const adjustDate = (days) => {
        // Split the date string and work with the parts directly
        const [year, month, day] = date.split('-').map(Number);

        // Create date in local timezone
        const currentDate = new Date(year, month - 1, day);
        currentDate.setDate(currentDate.getDate() + days);

        // Format back to YYYY-MM-DD
        const newYear = currentDate.getFullYear();
        const newMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
        const newDay = String(currentDate.getDate()).padStart(2, '0');

        setDate(`${newYear}-${newMonth}-${newDay}`);
    };

    // --- Stub function for booking ---
    const handleBookNow = (instance) => {
        alert(
            `STUB: Navigate to booking platform with:\n\nTour: ${tourName}\nDate: ${instance.date}\nTime: ${instance.time.substring(0, 5)}`
        );
    };

    const getStatusInfo = (instance) => {
        if (instance.status === 'cancelled') {
            return { text: 'Cancelled', className: styles.statusCancelled };
        }
        if (instance.available_seats <= 0) {
            return { text: 'Sold Out', className: styles.statusSoldOut };
        }
        return { text: 'Available', className: styles.statusAvailable };
    };

    const renderContent = () => {
        if (loading) {
            return <div className={styles.loader}>Loading...</div>;
        }
        if (error) {
            return <div className={styles.error}>Error: {error}</div>;
        }
        if (instances.length === 0) {
            return <div className={styles.noInstances}>No tours scheduled for this day.</div>;
        }

        return (
            <ul className={styles.instanceList}>
                {instances.map((instance) => {
                    const status = getStatusInfo(instance);
                    return (
                        <li key={instance.time} className={styles.instanceItem}>
                            <span className={styles.time}>{instance.time.substring(0, 5)}</span>

                            {status.text === 'Available' ? (
                                <button
                                    className={`${styles.statusOrButton} ${styles.bookButton}`}
                                    onClick={() => handleBookNow(instance)}
                                >
                                    Book Now
                                </button>
                            ) : (
                                <span className={`${styles.statusOrButton} ${styles.status} ${status.className}`}>
                                    {status.text}
                                </span>
                            )}

                        </li>
                    );
                })}
            </ul>
        );
    };

    return (
        <div className={styles.widgetContainer}>
            <h3 className={styles.title}>{tourName}</h3>

            <div className={styles.controls}>
                <button
                    className={styles.navButton}
                    onClick={() => adjustDate(-1)}
                >
                    &lt;
                </button>

                {/* This container positions the hidden input */}
                <div className={styles.dateInputContainer}>
                    {/* This <label> is the visible, clickable display */}
                    <label htmlFor="indicator-date" className={styles.dateInputDisplay}>
                        {formatDisplayDate(date)}
                    </label>
                    {/* This <input> is visually hidden by CSS, but triggered by the label */}
                    <input
                        id="indicator-date"
                        type="date"
                        className={styles.dateInput} // This class *actually* hides the input
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />
                </div>

                <button
                    className={styles.navButton}
                    onClick={() => adjustDate(1)}
                >
                    &gt;
                </button>
            </div>

            <div className={styles.contentArea}>
                {renderContent()}
            </div>
        </div>
    );
};

export default AvailabilityIndicatorWidget;