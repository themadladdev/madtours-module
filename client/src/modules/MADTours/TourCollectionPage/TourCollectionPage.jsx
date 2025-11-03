// client/src/modules/MADTours/TourCollectionPage/TourCollectionPage.jsx
import React, { useState, useEffect } from 'react';
import { getActiveTours } from '../../../services/public/tourBookingService.js';
import styles from './TourCollectionPage.module.css';

const TourCollectionPage = () => {
    const [tours, setTours] = useState([]);
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
        const loadTours = async () => {
            try {
                setLoading(true);
                setError(null);
                const activeTours = await getActiveTours();
                setTours(activeTours);
            } catch (err) {
                setError(err.message);
                console.error("Failed to load tours:", err);
            } finally {
                setLoading(false);
            }
        };

        loadTours();
    }, []);

    const renderContent = () => {
        if (loading) {
            return (
                <div className={styles.statusContainer}>
                    <div className={styles.spinner}></div>
                    <span>Loading available tours...</span>
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

        if (tours.length === 0) {
            return (
                <div className={styles.statusContainer}>
                    <p>No active tours are available at this time.</p>
                </div>
            );
        }

        return (
            <div className={styles.tourGrid}>
                {tours.map(tour => (
                    <div key={tour.id} className={styles.tourCard}>
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
                ))}
            </div>
        );
    };

    return (
        <div className={styles.pageContainer}>
            <div className={styles.pageHeader}>
                <h1>Find Your Next Tour</h1>
                <p>Browse our collection of available tours.</p>
            </div>
            {renderContent()}
        </div>
    );
};

export default TourCollectionPage;