// ==========================================
// UPDATED FILE
// client/src/adminPortal/MADTourManagement/BookingManager/BookingActionModal.jsx
// ==========================================

import React from 'react';
// --- [NEW] Import the standardized modal wrapper ---
import AdminFormModal from '../../../ui/modals/AdminFormModal.jsx';
import styles from './BookingActionModal.module.css';
import sharedStyles from '../../adminshared.module.css';

/**
 * A modal to display booking details and all available actions.
 * This component now renders *inside* the standardized AdminFormModal.
 *
 * @param {object} booking - The booking object to display.
 * @param {function} onClose - Function to call when the modal should close.
 * @param {function} onTriggerAction - Function to pass actionType and booking to.
 * @param {boolean} isResolutionView - If true, shows Triage actions.
 */
const BookingActionModal = ({ booking, onClose, onTriggerAction, isResolutionView }) => {
  // --- [REMOVED] All wrapper logic (backdrop, esc key) ---

  if (!booking) {
    return null;
  }

  return (
    // --- [NEW] Use the AdminFormModal as the wrapper ---
    <AdminFormModal
      isOpen={true}
      onClose={onClose}
      title="Booking Actions"
    >
      {/* This 'children' prop contains the modal's body and our custom footer */}
      <div>
        {/* --- Body (Details) --- */}
        {/* [MODIFIED] Using .detailsBody class to avoid conflicts */}
        <div className={styles.detailsBody}>
          <div className={styles.detailRow}>
            <strong>Reference:</strong>
            <span className={styles.reference}>{booking.booking_reference}</span>
          </div>
          <div className={styles.detailRow}>
            <strong>Customer:</strong>
            <span>{booking.first_name} {booking.last_name}</span>
          </div>
          <div className={styles.detailRow}>
            <strong>Email:</strong>
            <span>{booking.email}</span>
          </div>
          <div className={styles.detailRow}>
            <strong>Tour:</strong>
            <span>{booking.tour_name}</span>
          </div>
          <div className={styles.detailRow}>
            <strong>Date & Time:</strong>
            <span>
              {new Date(booking.date).toLocaleDateString()} @ {booking.time.substring(0, 5)}
            </span>
          </div>
          <div className={styles.detailRow}>
            <strong>Seats:</strong>
            <span>{booking.seats}</span>
          </div>
          <div className={styles.detailRow}>
            <strong>Total Amount:</strong>
            <span>${booking.total_amount}</span>
          </div>
          
          {/* --- [THIS IS THE FIX] --- */}
          <div className={styles.detailRow}>
            <strong>Booking Status:</strong>
            <div>
              <span className={`${styles.badge} ${styles[booking.status]}`}>
                {booking.status}
              </span>
            </div>
          </div>
          <div className={styles.detailRow}>
            <strong>Payment Status:</strong>
            <div>
              <span className={`${styles.badge} ${styles[booking.payment_status]}`}>
                {booking.payment_status}
              </span>
            </div>
          </div>
          {/* --- [END FIX] --- */}

        </div>
        
        {/* --- Footer (Actions) --- */}
        {/* [MODIFIED] Using .actionsFooter class */}
        <div className={styles.actionsFooter}>
          {isResolutionView ? (
            <>
              <button
                onClick={() => onTriggerAction('refund', booking)}
                className={sharedStyles.destructiveButton}
              >
                Process Refund
              </button>
              <button
                onClick={() => onTriggerAction('transfer', booking)}
                className={sharedStyles.primaryButton}
              >
                Transfer Booking
              </button>
            </>
          ) : (
            <>
              {booking.status === 'pending' && (
                <button
                  onClick={() => onTriggerAction('confirm', booking)}
                  className={sharedStyles.primaryButton}
                >
                  Confirm Booking
                </button>
              )}
              {booking.payment_status === 'pending' && (
                <button
                  onClick={() => onTriggerAction('pay', booking)}
                  className={sharedStyles.secondaryButton}
                >
                  Mark as Paid
                </button>
              )}
              {booking.status === 'pending' && (
                <button
                  onClick={() => onTriggerAction('cancel', booking)}
                  className={sharedStyles.destructiveGhostButton}
                >
                  Cancel Booking
                </button>
              )}
              {booking.status === 'confirmed' && booking.payment_status === 'paid' && (
                <button
                  onClick={() => onTriggerAction('refund', booking)}
                  className={sharedStyles.destructiveGhostButton}
                >
                  Process Refund
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </AdminFormModal>
  );
};

export default BookingActionModal;