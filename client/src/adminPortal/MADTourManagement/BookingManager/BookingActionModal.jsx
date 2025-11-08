// ==========================================
// UPDATED FILE
// client/src/adminPortal/MADTourManagement/BookingManager/BookingActionModal.jsx
// ==========================================

import React, { useState } from 'react';
import AdminFormModal from '../../../MADLibrary/admin/modals/AdminFormModal.jsx';
import MarkdownRenderer from '../../../MADLibrary/admin/MarkdownEditor/MarkdownRenderer.jsx';
import MarkdownEditor from '../../../MADLibrary/admin/MarkdownEditor/MarkdownEditor.jsx';
import { updateAdminNotes } from '../../../services/admin/adminBookingService.js';
import styles from './BookingActionModal.module.css';
import sharedStyles from '../../../MADLibrary/admin/styles/adminshared.module.css';

const BookingActionModal = ({ booking, onClose, onTriggerAction, isResolutionView }) => {

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

  return (
    <AdminFormModal
      isOpen={true}
      onClose={onClose}
      title="Booking Actions"
    >
      {/* --- [THIS IS THE FIX] --- */}
      {/* This wrapper div is required for the modal's flex layout to work. */}
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
                  // --- [THIS IS THE FIX] ---
                  className={sharedStyles.secondaryButtonSmall}
                  // ---
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
        
        {/* --- Footer (Actions) --- */}
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
      {/* --- [END FIX] --- */}
    </AdminFormModal>
  );
};

export default BookingActionModal;