// ==========================================
// ADMIN: Manifest View
// client/src/adminPortal/MADTourManagement/Manifest/ManifestView.jsx
// ==========================================

import React, { useState, useEffect } from 'react';
import { getManifest } from '../../../services/admin/adminTourService.js';
import styles from './ManifestView.module.css';
import sharedStyles from '../../adminshared.module.css'; // Import shared styles

const ManifestView = ({ instanceId }) => {
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);

  // Use our custom router logic
  const handleNavigate = (event, path) => {
    event.preventDefault();
    window.history.pushState({}, '', path);
    const navigationEvent = new CustomEvent('route-change');
    window.dispatchEvent(navigationEvent);
  };

  useEffect(() => {
    // Clear session storage after use
    sessionStorage.removeItem('currentManifest');
    loadManifest();
  }, [instanceId]);

  const loadManifest = async () => {
    setLoading(true);
    try {
      const data = await getManifest(instanceId);
      setManifest(data);
    } catch (error) {
      console.error('Error loading manifest:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className={sharedStyles.loadingContainer} style={{ minHeight: '100vh' }}>
        <div className={sharedStyles.spinner}></div>
        <span>Loading manifest...</span>
      </div>
    );
  }
  
  if (!manifest) {
    return (
       <div className={styles.manifestContainer}>
          <div className={sharedStyles.emptyState}>
            <p className={sharedStyles.errorText}>Error loading manifest.</p>
            <p>It may not exist, or an error occurred.</p>
            <br />
            <button 
              className={sharedStyles.secondaryButton}
              onClick={(e) => handleNavigate(e, '/admin/tours/dashboard')}
            >
              Back to Dashboard
            </button>
          </div>
       </div>
    );
  }

  const confirmedBookings = manifest.bookings.filter(b => b.booking_status === 'confirmed');
  const totalPax = confirmedBookings.reduce((sum, b) => sum + b.seats, 0);

  return (
    <div className={styles.manifestContainer}>
      <div className={styles.noPrint}>
        <button 
          onClick={(e) => handleNavigate(e, '/admin/tours/dashboard')}
          className={sharedStyles.secondaryButton}
          style={{ marginRight: '1rem' }}
        >
          Back to Dashboard
        </button>
        <button onClick={handlePrint} className={sharedStyles.primaryButton}>
          Print Manifest
        </button>
      </div>

      <div className={styles.manifest}>
        <div className={styles.header}>
          <h1>Tour Manifest</h1>
          <div className={styles.tourInfo}>
            <h2>{manifest.tour_name}</h2>
            <p><strong>Date:</strong> {new Date(manifest.date).toLocaleDateString()}</p>
            <p><strong>Time:</strong> {manifest.time}</p>
            <p><strong>Duration:</strong> {manifest.duration_minutes} minutes</p>
          </div>
        </div>

        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <strong>Total Passengers:</strong> {totalPax}
          </div>
          <div className={styles.summaryItem}>
            <strong>Capacity:</strong> {manifest.capacity}
          </div>
          <div className={styles.summaryItem}>
            <strong>Available:</strong> {manifest.available_seats}
          </div>
        </div>

        <div className={sharedStyles.contentBox}>
          <table className={sharedStyles.table}>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Pax</th>
                <th>Payment</th>
                <th>Special Requests</th>
              </tr>
            </thead>
            <tbody>
              {confirmedBookings.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                    No confirmed bookings
                  </td>
                </tr>
              ) : (
                confirmedBookings.map(booking => (
                  <tr key={booking.booking_reference}>
                    <td className={styles.reference}>{booking.booking_reference}</td>
                    <td className={styles.name}>{booking.customer_name}</td>
                    <td className={styles.contact}>
                      <div>{booking.customer_phone}</div>
                      <div className={styles.email}>{booking.customer_email}</div>
                    </td>
                    <td className={styles.seats}>{booking.seats}</td>
                    <td>
                      <span className={`${styles.paymentStatus} ${styles[booking.payment_status]}`}>
                        {booking.payment_status}
                      </span>
                    </td>
                    <td className={styles.requests}>
                      {booking.special_requests || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.footer}>
          <p>Generated: {new Date().toLocaleString()}</p>
          <p className={styles.emergency}>
            <strong>Emergency Contact:</strong> [Your emergency number here]
          </p>
        </div>
      </div>
    </div>
  );
};

export default ManifestView;