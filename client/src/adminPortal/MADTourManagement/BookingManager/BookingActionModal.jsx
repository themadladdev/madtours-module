// ==========================================
// client/src/adminPortal/MADTourManagement/BookingManager/BookingActionModal.jsx
// ==========================================

import React, { useState } from 'react';
import AdminFormModal from '../../../MADLibrary/admin/modals/AdminFormModal.jsx';
import MarkdownRenderer from '../../../MADLibrary/admin/MarkdownEditor/MarkdownRenderer.jsx';
import MarkdownEditor from '../../../MADLibrary/admin/MarkdownEditor/MarkdownEditor.jsx';
import { updateAdminNotes } from '../../../services/admin/adminBookingService.js';
import styles from './BookingActionModal.module.css';
import sharedStyles from '../../../MADLibrary/admin/styles/adminshared.module.css';

const BookingActionModal = ({ booking, onClose, onTriggerAction, isTriageView }) => {

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [adminNotes, setAdminNotes] = useState(booking.admin_notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState(null);

  if (!booking) {
    return null;
  }
  
  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    setNotesError(null);
    try {
      await updateAdminNotes(booking.id, adminNotes);
      booking.admin_notes = adminNotes; 
      setIsEditingNotes(false);
    } catch (err) {
      console.error('Failed to save admin notes:', err);
      setNotesError(`Failed to save: ${err.message}`);
    } finally {
      setIsSavingNotes(false);
    }
  };

  /**
   * --- [NEW] ---
   * Renders the conditional "Resolver" actions for the Triage queue.
   *
   */
  const renderTriageActions = () => {
    const paymentStatus = booking.payment_status;

    let refundAction = null;
    
    switch (paymentStatus) {
      case 'payment_stripe_success':
        refundAction = (
          <button
            onClick={() => onTriggerAction('resolve_stripe_refund', booking)}
            className={sharedStyles.destructiveButton}
          >
            Process Stripe Refund
          </button>
        );
        break;
      
      case 'payment_manual_success':
        refundAction = (
          <button
            onClick={() => onTriggerAction('resolve_manual_refund', booking)}
            className={sharedStyles.destructiveGhostButton}
          >
            Mark Manual Refund
          </button>
        );
        break;
        
      case 'payment_manual_pending':
      case 'payment_foc':
      case 'payment_none':
        refundAction = (
          <button
            onClick={() => onTriggerAction('resolve_cancel_unpaid', booking)}
            className={sharedStyles.destructiveGhostButton}
          >
            Cancel (No Refund)
          </button>
        );
        break;
        
      case 'refund_stripe_failed':
        refundAction = (
          <>
            <button
              onClick={() => onTriggerAction('resolve_retry_stripe', booking)}
              className={sharedStyles.destructiveButton}
            >
              Retry Stripe Refund
            </button>
            <button
              onClick={() => onTriggerAction('resolve_manual_refund', booking)}
              className={sharedStyles.destructiveGhostButton}
            >
              Mark Manual Refund
            </button>
          </>
        );
        break;
        
      default:
        // Covers 'refund_stripe_pending', 'refund_stripe_success', etc.
        // No refund action is appropriate in these states.
        refundAction = null;
    }

    return (
      <>
        {refundAction}
        <button
          onClick={() => onTriggerAction('transfer', booking)}
          className={sharedStyles.primaryButton}
        >
          Transfer Booking
        </button>
      </>
    );
  };

  /**
   * --- [NEW] ---
   * Renders the standard actions for non-Triage views.
   */
  const renderStandardActions = () => {
    const { seat_status, payment_status } = booking;

    if (seat_status === 'seat_confirmed') {
      return (
        <>
          {payment_status === 'payment_manual_pending' && (
            <button
              onClick={() => onTriggerAction('mark_as_paid', booking)}
              className={sharedStyles.primaryButton}
            >
              Mark as Paid (Cash)
            </button>
          )}
          {payment_status === 'payment_stripe_success' && (
            <button
              onClick={() => onTriggerAction('standard_refund', booking)}
              className={sharedStyles.destructiveGhostButton}
            >
              Process Refund
            </button>
          )}
          <button
            onClick={() => onTriggerAction('transfer', booking)}
            className={sharedStyles.secondaryButton}
          >
            Transfer Booking
          </button>
          <button
            onClick={() => onTriggerAction('standard_cancel', booking)}
            className={sharedStyles.destructiveGhostButton}
          >
            Cancel Booking
          </button>
        </>
      );
    }

    if (seat_status === 'seat_pending') {
      return (
        <>
          <button
            onClick={() => onTriggerAction('standard_cancel', booking)}
            className={sharedStyles.destructiveButton}
          >
            Cancel Booking
          </button>
        </>
      );
    }
    
    // No actions for 'seat_cancelled' or 'seat_noshow'
    return <p className={styles.notesPlaceholder}>No actions available for this booking status.</p>;
  };


  return (
    <AdminFormModal
      isOpen={true}
      onClose={onClose}
      title="Booking Actions"
    >
      <div className={styles.modalLayoutWrapper}>
      
        {/* --- Body (Details) --- */}
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
          
          {/* --- [REFACTORED] Use seat_status --- */}
          <div className={styles.detailRow}>
            <strong>Booking Status:</strong>
            <div>
              <span className={`${styles.badge} ${styles[booking.seat_status]}`}>
                {booking.seat_status}
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

          {/* --- Customer Notes Section --- */}
          {booking.customer_notes && (
            <div className={styles.detailBlock}>
              <strong>Customer Notes:</strong>
              <div className={styles.notesContainer}>
                <MarkdownRenderer markdown={booking.customer_notes} />
              </div>
            </div>
          )}
          
          {/* --- Admin Notes Section --- */}
          <div className={styles.detailBlock}>
            <div className={styles.notesHeader}>
              <strong>Admin Notes:</strong>
              {!isEditingNotes && (
                <button 
                  className={sharedStyles.secondaryButtonSmall}
                  onClick={() => setIsEditingNotes(true)}
                >
                  Edit
                </button>
              )}
            </div>
            
            {isEditingNotes ? (
              <div className={styles.notesEditorWrapper}>
                <MarkdownEditor
                  value={adminNotes}
                  onChange={setAdminNotes}
                  disabled={isSavingNotes}
                />
                {notesError && <p className={styles.notesError}>{notesError}</p>}
                <div className={styles.notesActions}>
                  <button
                    className={sharedStyles.secondaryButton}
                    onClick={() => {
                      setIsEditingNotes(false);
                      setAdminNotes(booking.admin_notes || '');
                      setNotesError(null);
                    }}
                    disabled={isSavingNotes}
                  >
                    Cancel
                  </button>
                  <button
                    className={sharedStyles.primaryButton}
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                  >
                    {isSavingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.notesContainer}>
                {booking.admin_notes ? (
                  <MarkdownRenderer markdown={booking.admin_notes} />
                ) : (
                  <span className={styles.notesPlaceholder}>No admin notes added.</span>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* --- [REFACTORED] Footer (Actions) --- */}
        <div className={styles.actionsFooter}>
          {isTriageView ? renderTriageActions() : renderStandardActions()}
        </div>
      </div>
    </AdminFormModal>
  );
};

export default BookingActionModal;