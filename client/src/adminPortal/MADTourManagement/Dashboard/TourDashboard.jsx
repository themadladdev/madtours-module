// client/src/adminPortal/MADTourManagement/Dashboard/TourDashboard.jsx
import React, { useState, useEffect } from 'react';
import { getTourInstances, getManifest } from '../../../services/admin/adminTourService.js';
import { getDashboardStats } from '../../../services/admin/adminBookingService.js';
import styles from './TourDashboard.module.css';
import sharedStyles from '../../adminshared.module.css'; // Import shared styles

const TourDashboard = () => {
  const [stats, setStats] = useState(null);
  const [todayTours, setTodayTours] = useState([]);
  const [loading, setLoading] = useState(true);

  // Use our custom router logic
  const handleNavigate = (event, path) => {
    event.preventDefault();
    window.history.pushState({}, '', path);
    const navigationEvent = new CustomEvent('route-change');
    window.dispatchEvent(navigationEvent);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [statsData, instancesData] = await Promise.all([
        getDashboardStats(),
        getTourInstances({ 
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        })
      ]);

      setStats(statsData.stats);
      setTodayTours(instancesData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewManifest = async (instanceId) => {
    try {
      const manifest = await getManifest(instanceId);
      // Store in sessionStorage and navigate
      sessionStorage.setItem('currentManifest', JSON.stringify(manifest));
      handleNavigate(new Event('click'), `/admin/tours/manifest/${instanceId}`);
    } catch (error) {
      console.error('Error loading manifest:', error);
    }
  };

  if (loading) {
    return (
      <div className={sharedStyles.loadingContainer}>
        <div className={sharedStyles.spinner}></div>
        <span>Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      {/* <h1> HAS BEEN REMOVED - Handled by wrapper */}

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <h3>Today's Tours</h3>
          <p className={styles.statValue}>{todayTours.length}</p>
        </div>
        <div className={styles.statCard}>
          <h3>Upcoming Tours</h3>
          <p className={styles.statValue}>{stats?.upcoming_tours || 0}</p>
        </div>
        <div className={styles.statCard}>
          <h3>Confirmed Bookings</h3>
          <p className={styles.statValue}>{stats?.total_confirmed_bookings || 0}</p>
        </div>
        <div className={styles.statCard}>
          <h3>Pending Bookings</h3>
          <p className={styles.statValue}>{stats?.pending_bookings || 0}</p>
        </div>
      </div>

      <div className={styles.todaySection}>
        <h2>Today's Tours</h2>
        {todayTours.length === 0 ? (
          <div className={sharedStyles.emptyState}>
            <p>No tours scheduled for today.</p>
          </div>
        ) : (
          <div className={styles.toursList}>
            {/* === FIX 1: Add composite key for virtual instances === */}
            {todayTours.map(tour => (
              <div 
                key={tour.id || `gen-${tour.tour_id}-${tour.date}-${tour.time}`} 
                className={styles.tourCard}
              >
                <div className={styles.tourHeader}>
                  <h3>{tour.tour_name}</h3>
                  <span className={`${styles.status} ${styles[tour.status]}`}>
                    {tour.status}
                  </span>
                </div>
                <div className={styles.tourDetails}>
                  <p><strong>Time:</strong> {tour.time.substring(0, 5)}</p>
                  <p><strong>Capacity:</strong> {tour.booked_seats}/{tour.capacity}</p>
                  <p><strong>Available:</strong> {tour.available_seats} seats</p>
                </div>
                <div className={styles.tourActions}>
                  {/* === FIX 2: Disable button if instance is virtual (no id) === */}
                  <button 
                    onClick={() => handleViewManifest(tour.id)}
                    className={sharedStyles.primaryButtonSmall}
                    disabled={!tour.id}
                    title={!tour.id ? "Manifest becomes available after first booking" : "View tour manifest"}
                  >
                    View Manifest
                  </button>
                  {/* We can re-enable this if a "Manage Instance" page is built */}
                  {/* <button 
                    onClick={() => handleNavigate(new Event('click'), `/admin/tours/instance/${tour.id}`)}
                    className={sharedStyles.secondaryButtonSmall}
                  >
                    Manage
                  </button> */}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.quickActions}>
        <h2>Quick Actions</h2>
        <div className={styles.actionButtons}>
          <a href="/admin/tours/calendar" onClick={(e) => handleNavigate(e, '/admin/tours/calendar')} className={sharedStyles.primaryButton}>
            Tour Calendar
          </a>
          <a href="/admin/tours/bookings" onClick={(e) => handleNavigate(e, '/admin/tours/bookings')} className={sharedStyles.primaryButton}>
            View All Bookings
          </a>
        </div>
      </div>
    </div>
  );
};

export default TourDashboard;