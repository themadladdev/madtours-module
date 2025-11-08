// client/src/modules/MADTours/FeaturedTourWidget/FeaturedTourWidget.jsx
import React, { useState, useEffect } from 'react';
import { getTourById } from '../../../../services/public/tourBookingService.js';
import styles from './FeaturedTourWidget.module.css';

const FeaturedTourWidget = ({ tourId }) => {
    const [tour, setTour] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Standard navigation function
    const handleNavigate = (event, path) => {
        event.preventDefault();
        window.history.pushState({}, '', path);
        const navigationEvent = new CustomEvent('route-change');
        window.dispatchEvent(navigationEvent);
    };

    useEffect(() => {
        if (!tourId) {
            setError("No tour ID provided.");
            setLoading(false);
            return;
        }

        const loadTour = async () => {
            try {
                setLoading(true);
                setError(null);
                const tourData = await getTourById(tourId);
                setTour(tourData);
            } catch (err) {
                setError(err.message);
                console.error(`Failed to load tour ${tourId}:`, err);
            } finally {
                setLoading(false);
            }
        };

        loadTour();
    }, [tourId]); // Reload if the tourId prop changes

    if (loading) {
        return (
            <div className={`${styles.widgetContainer} ${styles.statusContainer}`}>
                <div className={styles.spinner}></div>
                <span>Loading feature...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`${styles.widgetContainer} ${styles.statusContainer}`}>
                <p className={styles.errorText}>
                    Error: {error}
                </p>
            </div>
        );
    }

    if (!tour) {
        return null; // Don't render anything if tour data is empty
    }

    return (
        <div className={styles.widgetContainer}>
            <div className={styles.tourHeader}>
                <h3 className={styles.tourName}>{tour.name}</h3>
                <span className={styles.tourPrice}>
                    ${parseFloat(tour.base_price).toFixed(2)}
                </span>
            </div>
            <p className={styles.tourDescription}>
                {tour.description}
            </p>
            <div className={styles.tourFooter}>
                <span className={styles.tourDuration}>
                    {tour.duration_minutes} minutes
                </span>
                <a
                    href={`/tours/${tour.id}`}
                    onClick={(e) => handleNavigate(e, `/tours/${tour.id}`)}
                    className={styles.detailsButton}
                >
                    View Details
                </a>
            </div>
        </div>
    );
};

export default FeaturedTourWidget;