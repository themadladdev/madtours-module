// ==========================================
// client/src/adminPortal/MADTourManagement/Dashboard/TourDashboard.jsx
// ==========================================

import React, { useState, useEffect } from 'react';
import { getDirectionalDashboard } from '../../../services/admin/adminBookingService.js';
import { getTourInstances } from '../../../services/admin/adminTourService.js';
import styles from './TourDashboard.module.css';
import sharedStyles from '../../../MADLibrary/admin/styles/adminshared.module.css';

import StatusIndicator from '../../../MADLibrary/admin/dashboard/StatusIndicator/StatusIndicator.jsx';
import ProgressDonut from '../../../MADLibrary/admin/dashboard/ProgressDonut/ProgressDonut.jsx';
import Sparkline from '../../../MADLibrary/admin/charts/Sparkline/Sparkline.jsx';

// --- Import icons ---
import UserIcon from '../../../MADLibrary/admin/icons/UserIcon.jsx';
import TicketIcon from '../../../MADLibrary/admin/icons/TicketIcon.jsx';

// Reusable loader component
const LoadingSpinner = ({ text }) => (
  <div className={sharedStyles.loadingContainer} style={{ minHeight: '150px' }}>
    <div className={sharedStyles.spinner}></div>
    <span>{text || 'Loading...'}</span>
  </div>
);

// Reusable component for Triage/Action items
const TriageLink = ({ label, count, path, filterKey, isLoading }) => {
  // Use our custom router logic
  const handleNavigate = (event, path, filterKey) => {
    event.preventDefault();
    
    // Set sessionStorage key for the destination component to read
    if (filterKey) {
        sessionStorage.setItem('admin_preset_filter', filterKey);
    }
    
    window.history.pushState({}, '', path);
    const navigationEvent = new CustomEvent('route-change');
    window.dispatchEvent(navigationEvent);
  };

  return (
    <a
      href={path}
      onClick={(e) => handleNavigate(e, path, filterKey)}
      className={styles.triageLink}
    >
      <span className={styles.triageLabel}>{label}</span>
      <span className={`${styles.triageCount} ${count > 0 ? styles.triageCountAlert : ''}`}>
        {isLoading ? '-' : count}
      </span>
    </a>
  );
};

// Reusable component for DenseStatRow
const DenseStatRow = ({ label, value, subtext, subtextIcon, sparklineData, isLoading }) => (
  <div className={styles.denseStatRow}>
    <span className={styles.denseStatLabel}>{label}</span>
    {isLoading ? (
      <span className={styles.denseStatValue}>-</span>
    ) : (
      <span className={styles.denseStatValue}>
        {value}
        {sparklineData && sparklineData.length > 0 && (
          <span className={styles.sparklineWrapper}>
            <Sparkline data={sparklineData} width={60} height={16} />
          </span>
        )}
        
        <span className={styles.denseStatSubtext}>
          <span className={styles.denseStatSubtextValue}>
            {subtext}
          </span>
          <span className={styles.denseStatSubtextIcon}>
            {subtextIcon === 'user' && <UserIcon />}
            {subtextIcon === 'ticket' && <TicketIcon />}
          </span>
        </span>
      </span>
    )}
  </div>
);


const TourDashboard = () => {
  const [data, setData] = useState(null);
  const [todayTours, setTodayTours] = useState([]);
  const [loading, setLoading] = useState(true);

  const monthName = new Date().toLocaleString('default', { month: 'long' });

  // Use our custom router logic for non-triage links
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
    setLoading(true);
    try {
      const [statsData, instancesData] = await Promise.all([
        getDirectionalDashboard(),
        getTourInstances({ 
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        })
      ]);

      setData(statsData);
      setTodayTours(instancesData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleManifestNavigate = (e, instanceId) => {
    e.stopPropagation(); 
    handleNavigate(new Event('click'), `/admin/tours/manifest/${instanceId}`);
  };

  const handleRowClick = (e, tour) => {
    if (tour.id) {
        handleNavigate(e, `/admin/tours/manifest/${tour.id}`);
    }
  };

  const totalTodaySeats = todayTours.reduce(
    (acc, tour) => acc + tour.booked_seats,
    0
  );

  return (
    <div className={styles.dashboardContainer}>
      
      {/* Column 1: Triage & Action Center */}
      <div className={styles.dashboardColumn}>
        <div className={styles.dashboardCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.columnTitle}>Action Center</h2>
          </div>
          <div className={styles.cardSection}>
            <h3 className={styles.columnSubTitle}>Triage Queue</h3>
            <div className={styles.triageGroup}>
              <TriageLink
                label="Bookings Pending Triage"
                count={data?.triage?.pending_triage || 0}
                path="/admin/tours/bookings"
                filterKey="action_required"
                isLoading={loading}
              />
              {/* --- [MODIFIED] filterKey --- */}
              <TriageLink
                label="Pending Bookings (> 1hr)"
                count={data?.triage?.pending_bookings || 0}
                path="/admin/tours/bookings"
                filterKey="pending_inventory"
                isLoading={loading}
              />
              <TriageLink
                label="Failed Payments"
                count={data?.triage?.failed_payments || 0}
                path="/admin/tours/bookings"
                filterKey="action_required"
                isLoading={loading}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Column 2: Today's Tours */}
      <div className={styles.dashboardColumn}>
        <div className={styles.dashboardCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.columnTitle}>Today's Tours</h2>
            {!loading && (
              <span className={styles.headerStat}>
                <span className={styles.headerStatIcon}>
                  <UserIcon />
                </span>
                <span className={styles.headerStatText}>
                  Total Seats: <strong>{totalTodaySeats}</strong>
                </span>
              </span>
            )}
          </div>
          
          <div className={styles.toursList}>
            {loading ? (
              <div style={{ padding: '1.5rem' }}>
                <LoadingSpinner text="Loading today's tours..." />
              </div>
            ) : todayTours.length === 0 ? (
              <div className={sharedStyles.emptyState} style={{padding: '1.5rem'}}>
                <p>No tours scheduled for today.</p>
              </div>
            ) : (
              <table className={styles.toursTable}>
                <tbody>
                  {todayTours.map(tour => (
                    <tr 
                      key={tour.id || `gen-${tour.tour_id}-${tour.date}-${tour.time}`}
                      className={`${styles.tourRow} ${tour.id ? styles.clickableRow : ''}`}
                      onClick={(e) => handleRowClick(e, tour)}
                      title={tour.id ? "View tour manifest" : "Manifest available after first booking"}
                    >
                      <td className={styles.tourTime}>{tour.time.substring(0, 5)}</td>
                      <td className={styles.tourName}>{tour.tour_name}</td>
                      <td className={styles.tourSeats}>
                        <ProgressDonut 
                          value={tour.booked_seats} 
                          max={tour.capacity} 
                        />
                        <span className={styles.tourSeatsMax}>
                          / {tour.capacity}
                        </span>
                      </td>
                      <td className={styles.tourStatus}>
                        <StatusIndicator variant={tour.status}>
                          {tour.status}
                        </StatusIndicator>
                      </td>
                      <td className={styles.tourAction}>
                        <button
                          onClick={(e) => handleManifestNavigate(e, tour.id)}
                          className={sharedStyles.secondaryButtonSmall}
                          disabled={!tour.id}
                        >
                          Manifest
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Column 3: Statistics */}
      <div className={styles.dashboardColumn}>
        {/* Card 1: Tour Statistics */}
        <div className={styles.dashboardCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.columnTitle}>Tour Statistics</h2>
          </div>
          <div className={styles.cardSection}>
            <div className={styles.denseStatGroup}>
              <DenseStatRow
                label="Today"
                value={`$${data?.tourStats?.today?.value || 0}`}
                subtext={data?.tourStats?.today?.seats || 0}
                subtextIcon="user"
                isLoading={loading}
              />
              <DenseStatRow
                label="Weekly (Current)"
                value={`$${data?.tourStats?.week?.value || 0}`}
                subtext={data?.tourStats?.week?.seats || 0}
                subtextIcon="user"
                sparklineData={data?.tourStats?.week?.trend}
                isLoading={loading}
              />
              <DenseStatRow
                label={`Monthly (${monthName})`}
                value={`$${data?.tourStats?.month?.value || 0}`}
                subtext={data?.tourStats?.month?.seats || 0}
                subtextIcon="user"
                isLoading={loading}
              />
              <DenseStatRow
                label="Next 90 Days"
                value={`$${data?.tourStats?.next90Days?.value || 0}`}
                subtext={data?.tourStats?.next90Days?.seats || 0}
                subtextIcon="user"
                isLoading={loading}
              />
            </div>
          </div>
        </div>
        
        {/* Card 2: Booking Statistics */}
        <div className={styles.dashboardCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.columnTitle}>Booking Statistics</h2>
          </div>
          <div className={styles.cardSection}>
            <div className={styles.denseStatGroup}>
              <DenseStatRow
                label="Today"
                value={`$${data?.bookingStats?.today?.revenue || 0}`}
                subtext={data?.bookingStats?.today?.bookings || 0}
                subtextIcon="ticket"
                isLoading={loading}
              />
              <DenseStatRow
                label="Weekly (Mon-Sun)"
                value={`$${data?.bookingStats?.week?.revenue || 0}`}
                subtext={data?.bookingStats?.week?.bookings || 0}
                subtextIcon="ticket"
                sparklineData={data?.bookingStats?.week?.trend}
                isLoading={loading}
              />
              <DenseStatRow
                label={`Monthly (${monthName})`}
                value={`$${data?.bookingStats?.month?.revenue || 0}`}
                subtext={data?.bookingStats?.month?.bookings || 0}
                subtextIcon="ticket"
                isLoading={loading}
              />
              <DenseStatRow
                label="Year-to-Date"
                value={`$${data?.bookingStats?.ytd?.revenue || 0}`}
                subtext={data?.bookingStats?.ytd?.bookings || 0}
                subtextIcon="ticket"
                isLoading={loading}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TourDashboard;