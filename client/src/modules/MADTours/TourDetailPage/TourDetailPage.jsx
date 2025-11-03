// client/src/modules/MADTours/TourDetailPage/TourDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { getTourById } from '../../../services/public/tourBookingService.js';
import styles from './TourDetailPage.module.css';
import BookingCalendar from '../../../ui/MADTours/BookingCalendar/BookingCalendar.jsx'; // Import the child widget

// This component receives the 'id' from the router in App.jsx
const TourDetailPage = ({ id }) => {
    const [tour, setTour] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // State for pre-filled data from the URL query
    const [prefilledDate, setPrefilledDate] = useState(null);
    const [prefilledGuests, setPrefilledGuests] = useState(1);

    useEffect(() => {
        // Read query params from URL (e.g., from AvailabilityWidget)
        const params = new URLSearchParams(window.location.search);
        const date = params.get('date');
        const guests = params.get('guests');
        
        if (date) {
            setPrefilledDate(date);
        }
        if (guests) {
            setPrefilledGuests(parseInt(guests, 10) || 1);
        }

        // Fetch the static tour details
        const loadTour = async () => {
            try {
                setLoading(true);
                setError(null);
                const tourData = await getTourById(id);
                setTour(tourData);
            } catch (err) {
                setError(err.message);
                console.error(`Failed to load tour ${id}:`, err);
            } finally {
                setLoading(false);
            }
        };

        loadTour();
    }, [id]); // Reload if the tour ID changes

    if (loading) {
        return (
            <div className={styles.statusContainer}>
                <div className={styles.spinner}></div>
                <span>Loading tour details...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.statusContainer}>
                <p className={styles.errorText}>
                    Error: {error}
                </p>
            </div>
        );
    }

    if (!tour) {
        return (
            <div className={styles.statusContainer}>
                <p>Tour not found.</p>
            </div>
        );
    }

    return (
        <div className={styles.pageContainer}>
            {/* Column 1: Tour Info */}
            <div className={styles.infoColumn}>
                <h1 className={styles.tourName}>{tour.name}</h1>
                <p className={styles.tourDescription}>{tour.description}</p>
                
                <div className={styles.metaGrid}>
                    <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Duration</span>
                        <span className={styles.metaValue}>{tour.duration_minutes} min</span>
                    </div>
                    <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Base Price</span>
                        <span className={styles.metaValue}>${parseFloat(tour.base_price).toFixed(2)}</span>
                    </div>
                    <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Capacity</span>
                        <span className={styles.metaValue}>Up to {tour.capacity} guests</span>
                    </div>
                </div>
            </div>

            {/* Column 2: Booking Widget */}
            <div className={styles.widgetColumn}>
                <BookingCalendar 
                    tourId={tour.id} 
                    basePrice={tour.base_price}
                    defaultDate={prefilledDate}
                    defaultGuests={prefilledGuests}
                />
            </div>
        </div>
    );
};

export default TourDetailPage;