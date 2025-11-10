// ==========================================
// client/src/adminPortal/MADTourManagement/Manifest/ManifestView.jsx
// ==========================================

import React, { useState, useEffect } from 'react';
import { getManifest } from '../../../services/admin/adminTourService.js';
import styles from './ManifestView.module.css';
import sharedStyles from '../../../MADLibrary/admin/styles/adminshared.module.css';

import ManifestEditorModal from './ManifestEditorModal.jsx';
import ManualBookingModal from '../BookingManager/ManualBookingModal.jsx';

const ManifestView = ({ instanceId }) => {
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const [isManualBookingModalOpen, setIsManualBookingModalOpen] = useState(false);

  // --- [MODIFIED] Using the correct shared navigation logic ---
  const handleNavigate = (event, path, filterKey = null) => {
    event.preventDefault();
    
    // Set sessionStorage key for the destination component to read
    if (filterKey) {
        sessionStorage.setItem('admin_preset_filter', filterKey);
    }
    
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

  const handleOpenEditor = (booking) => {
    setSelectedBooking(booking);
    setIsEditorModalOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorModalOpen(false);
    setSelectedBooking(null);
  };

  const handleSaveSuccess = () => {
    loadManifest();
  };
  
  const renderBookingRows = (booking) => {
    const elements = [];
    const hasAllPassengerNames = booking.passengers.length === booking.seats_total;
    
    if (hasAllPassengerNames) {
      const totalPassengers = booking.passengers.length;

      elements.push(
        <tr 
          key={booking.booking_reference} 
          className={`${styles.passengerRow} ${styles.editableRow}`}
          onClick={() => handleOpenEditor(booking)}
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

      for (let i = 1; i < totalPassengers; i++) {
        elements.push(
          <tr 
            key={`${booking.booking_reference}-${i}`} 
            className={`${styles.passengerRow} ${styles.editableRow}`}
            onClick={() => handleOpenEditor(booking)}
          >
            <td className={styles.name}>{booking.passengers[i].first_name} {booking.passengers[i].last_name}</td>
          </tr>
        );
      }
    } 
    
    else {
      const payer = booking.passengers[0] || booking.customer;
      
      elements.push(
        <tr 
          key={booking.booking_reference} 
          className={`${styles.fallbackRow} ${styles.editableRow}`}
          onClick={() => handleOpenEditor(booking)}
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
      <ManifestEditorModal
        isOpen={isEditorModalOpen}
        onClose={handleCloseEditor}
        booking={selectedBooking}
        onSaveSuccess={handleSaveSuccess}
      />

      <ManualBookingModal
        isOpen={isManualBookingModalOpen}
        onClose={() => {
            setIsManualBookingModalOpen(false);
            loadManifest(); 
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
            style={{ marginRight: 'auto' }}
          >
            Back to Dashboard
          </button>
          
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
              <p><strong>Date:</strong> {new Date(manifest.date).toLocaleDateString()}</p>
              <p><strong>Time:</strong> {manifest.time}</p>
              <p><strong>Duration:</strong> {manifest.duration_minutes} minutes</p>
            </div>
          </div>

          {/* --- [MODIFIED] Summary Section --- */}
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
            
            {/* --- [NEW] Pending Inventory Link --- */}
            {manifest.pending_inventory_seats > 0 && (
              <div className={`${styles.summaryItem} ${styles.pendingWarning}`}>
                <strong>Seats Pending:</strong> {manifest.pending_inventory_seats}
                <a 
                  href="/admin/tours/bookings" 
                  onClick={(e) => handleNavigate(e, '/admin/tours/bookings', 'pending_inventory')}
                  className={styles.pendingLink}
                  title="View held inventory"
                >
                  (View)
                </a>
              </div>
            )}
            {/* --- [END NEW] --- */}
          </div>
          {/* --- [END MODIFIED] --- */}


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
                  confirmedBookings.flatMap(booking => renderBookingRows(booking))
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