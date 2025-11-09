// client/src/adminPortal/MADTourManagement/Manifest/ManifestView.jsx
import React, { useState, useEffect } from 'react';
import { getManifest } from '../../../services/admin/adminTourService.js';
import styles from './ManifestView.module.css';
import sharedStyles from '../../../MADLibrary/admin/styles/adminshared.module.css';

import ManifestEditorModal from './ManifestEditorModal.jsx';
import ManualBookingModal from '../BookingManager/ManualBookingModal.jsx';

const ManifestView = ({ instanceId }) => {
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // --- State for the editor modal ---
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // --- [NEW] State for the manual booking modal ---
  const [isManualBookingModalOpen, setIsManualBookingModalOpen] = useState(false);

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

  // --- Editor Modal open/close handlers ---
  const handleOpenEditor = (booking) => {
    setSelectedBooking(booking);
    setIsEditorModalOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorModalOpen(false);
    setSelectedBooking(null);
  };

  const handleSaveSuccess = () => {
    // Reload the manifest to show the new data
    loadManifest();
  };
  
  // --- RE-WRITTEN: This logic is now correct ---
  const renderBookingRows = (booking) => {
    const elements = [];
    const hasAllPassengerNames = booking.passengers.length === booking.seats_total;
    
    // --- BUG FIX: This is the correct logic ---
    // 1. High-Detail: We have a name for every seat.
    if (hasAllPassengerNames) {
      const totalPassengers = booking.passengers.length;

      // Create the first row (Payer)
      elements.push(
        <tr 
          key={booking.booking_reference} 
          className={`${styles.passengerRow} ${styles.editableRow}`}
          onClick={() => handleOpenEditor(booking)} // --- Click handler ---
        >
          <td rowSpan={totalPassengers} className={styles.reference}>{booking.booking_reference}</td>
          <td className={styles.name}>{booking.passengers[0].first_name} {booking.passengers[0].last_name}</td>
          <td rowSpan={totalPassengers} className={styles.contact}>
            <div>{booking.customer.phone}</div>
            <div className={styles.email}>{booking.customer.email}</div>
          </td>
          <td rowSpan={totalPassengers} className={styles.seats}>{booking.seats_total}</td>
          <td rowSpan={totalPassengers}>
            <span className={`${styles.paymentStatus} ${styles[booking.payment_status]}`}>
              {booking.payment_status}
            </span>
          </td>
          <td rowSpan={totalPassengers} className={styles.requests}>
            {booking.special_requests || '-'}
          </td>
        </tr>
      );

      // Create all subsequent rows for other passengers
      for (let i = 1; i < totalPassengers; i++) {
        elements.push(
          <tr 
            key={`${booking.booking_reference}-${i}`} 
            className={`${styles.passengerRow} ${styles.editableRow}`}
            onClick={() => handleOpenEditor(booking)} // --- Click handler ---
          >
            {/* This row ONLY contains the name, as all other cells are row-spanned */}
            <td className={styles.name}>{booking.passengers[i].first_name} {booking.passengers[i].last_name}</td>
          </tr>
        );
      }
    } 
    
    // --- BUG FIX: This path will now be correctly used ---
    // 2. Low-Friction Fallback: Not all passenger names provided
    else {
      // Get the first passenger (the "Payer" row)
      const payer = booking.passengers[0] || booking.customer;
      
      elements.push(
        <tr 
          key={booking.booking_reference} 
          className={`${styles.fallbackRow} ${styles.editableRow}`}
          onClick={() => handleOpenEditor(booking)} // --- Click handler ---
        >
          <td className={styles.reference}>{booking.booking_reference}</td>
          <td className={styles.name}>
            {payer.first_name} {payer.last_name}
            <span className={styles.fallbackLabel}>(Payer - Click to add remaining {booking.seats_total - 1} names)</span>
          </td>
          <td className={styles.contact}>
            <div>{booking.customer.phone}</div>
            <div className={styles.email}>{booking.customer.email}</div>
          </td>
          <td className={styles.seats}>{booking.seats_total}</td>
          <td>
            <span className={`${styles.paymentStatus} ${styles[booking.payment_status]}`}>
              {booking.payment_status}
            </span>
          </td>
          <td className={styles.requests}>
            {booking.special_requests || '-'}
          </td>
        </tr>
      );
    }
    
    return elements;
  };
  // --- END RE-WRITE ---

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

  const confirmedBookings = manifest.confirmed_bookings || [];
  const totalPax = manifest.total_confirmed_seats || 0;

  return (
    <>
      {/* --- Render the editor modal --- */}
      <ManifestEditorModal
        isOpen={isEditorModalOpen}
        onClose={handleCloseEditor}
        booking={selectedBooking}
        onSaveSuccess={handleSaveSuccess}
      />

      {/* --- [NEW] Render the manual booking modal --- */}
      {/* This entry point passes context so the form is pre-filled */}
      <ManualBookingModal
        isOpen={isManualBookingModalOpen}
        onClose={() => {
            setIsManualBookingModalOpen(false);
            loadManifest(); // Refresh manifest after modal closes
        }}
        initialTourId={manifest.tour_id}
        initialDate={manifest.date}
        initialTime={manifest.time}
      />
    
      <div className={styles.manifestContainer}>
        <div className={styles.noPrint}>
          <button 
            onClick={(e) => handleNavigate(e, '/admin/tours/dashboard')}
            className={sharedStyles.secondaryButton}
            style={{ marginRight: 'auto' }} /* Pushes other buttons right */
          >
            Back to Dashboard
          </button>
          
          {/* --- [NEW] Add Booking button --- */}
          <button 
            onClick={() => setIsManualBookingModalOpen(true)}
            className={sharedStyles.secondaryButton}
            style={{ marginRight: '1rem' }}
          >
            Create New Booking
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
              {/* FIX: Corrected UTC date display */}
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
            {/* FIX: Corrected missing syntax from previous error */}
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
                  // --- REFACTORED: Use the new render function ---
                  confirmedBookings.flatMap(booking => renderBookingRows(booking))
                  // --- END REFACTOR ---
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
    </>
  );
};

export default ManifestView;