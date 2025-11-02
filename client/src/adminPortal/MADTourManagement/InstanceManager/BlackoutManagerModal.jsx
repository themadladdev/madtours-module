// client/src/adminPortal/MADTourManagement/InstanceManager/BlackoutManagerModal.jsx
import React, { useState, useEffect } from 'react';
import AdminFormModal from '../../../ui/modals/AdminFormModal.jsx';
// NEW: Import the standard ConfirmationDialog
import ConfirmationDialog from '../../../ui/dialogbox/ConfirmationDialog.jsx';
import * as adminTourService from '../../../services/admin/adminTourService.js';
import styles from './BlackoutManagerModal.module.css';
import sharedStyles from '../../adminshared.module.css';

const BlackoutManagerModal = ({ isOpen, onClose, tour, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  
  // --- FIX: Re-instating Toast Notification for errors ---
  const [toast, setToast] = useState(null); 
  const [error, setError] = useState(''); // This is for form validation only
  
  // --- NEW: State for the blackout form ---
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState('');
  
  // --- NEW: State for the confirmation dialog ---
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    // Reset form when modal opens
    if (isOpen) {
      setStartDate(today);
      setEndDate(today);
      setReason('');
      setError('');
      setLoading(false);
      setIsConfirming(false);
      setToast(null); // Clear toast on open
    }
  }, [isOpen]);

  // --- FIX: Add back useEffect to clear toast ---
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  // --- END FIX ---

  // --- NEW: Handle opening the confirmation dialog ---
  const handleApplyClick = () => {
    if (!reason) {
      setError('A reason is required to apply a blackout.');
      return;
    }
    if (!startDate || !endDate) {
      setError('A valid start and end date are required.');
      return;
    }
    setError('');
    setIsConfirming(true);
  };
  
  const handleCloseConfirm = () => {
    setIsConfirming(false);
  };

  // --- NEW: This is the real submission logic ---
  const handleConfirmBlackout = async () => {
    setLoading(true);
    setError('');
    
    console.log(`[BlackoutManager] Applying blackout for Tour ID ${tour.id}...`);
    console.log(`[BlackoutManager] Range: ${startDate} to ${endDate}`);
    console.log(`[BlackoutManager] Reason: ${reason}`);

    try {
      const result = await adminTourService.applyBlackout({
        tourId: tour.id,
        startDate,
        endDate,
        reason
      });
      
      console.log('[BlackoutManager] Success:', result);
      
      // --- START FIX: Close self *before* calling parent ---
      setLoading(false);
      setIsConfirming(false);
      onSuccess(result); // Tell parent to refresh
      // --- END FIX ---

    } catch (err) {
      console.error('[BlackoutManager] Error applying blackout:', err);
      // --- FIX: Use toast for API errors, not inline ---
      setToast({ type: 'error', message: err.message || 'Failed to apply blackout.' });
      setError(''); // Clear form validation
      // --- END FIX ---
      setLoading(false); // Keep modal open to show error
      setIsConfirming(false); // Close confirmation dialog
    }
  };

  return (
    <>
      <AdminFormModal 
        isOpen={isOpen && !isConfirming} // Hide if confirm dialog is open
        onClose={onClose} 
        title={`Apply Blackout for ${tour?.name}`}
      >
        
        {/* --- FIX: Re-instated Toast Notification --- */}
        {toast && (
          <div 
            className={sharedStyles.toastNotification}
            style={{ 
              borderLeftColor: toast.type === 'error' ? 'var(--destructive)' : 'var(--text)',
              position: 'absolute', // Position inside the modal
              top: '1.5rem',
              right: '1.5rem',
              zIndex: 2000 // Ensure it's on top
            }}
          >
            <p>{toast.message}</p>
          </div>
        )}
        {/* --- END FIX --- */}
        
        <p className={sharedStyles.description}>
          Select a date range and provide a reason to operationally cancel
          all tours. This will move all existing bookings to 'Pending Triage'.
        </p>
        
        <div className={styles.blackoutForm}>
          <div className={sharedStyles.formGroup}>
            <label htmlFor="blackout-start-date">Start Date</label>
            <input
              id="blackout-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={sharedStyles.input}
              disabled={loading}
            />
          </div>
          <div className={sharedStyles.formGroup}>
            <label htmlFor="blackout-end-date">End Date</label>
            <input
              id="blackout-end-date"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={sharedStyles.input}
              disabled={loading}
            />
          </div>
          <div className={sharedStyles.formGroup} style={{ flexBasis: '100%' }}>
            <label htmlFor="blackout-reason">Reason (Required)</label>
            <textarea
              id="blackout-reason"
              rows="3"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={sharedStyles.textarea}
              placeholder="e.g., Cyclone warning, private event, off-season..."
              disabled={loading}
            />
          </div>
        </div>

        {/* --- FIX: This is now for FORM validation only --- */}
        {error && <p className={sharedStyles.errorText} style={{ marginTop: '1rem' }}>{error}</p>}

        <div className={sharedStyles.formFooter}>
          <button 
            type="button" 
            className={sharedStyles.secondaryButton}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className={sharedStyles.destructiveButton} // Changed to destructive
            onClick={handleApplyClick}
            disabled={loading || !tour}
          >
            {loading ? 'Applying...' : 'Apply Blackout'}
          </button>
        </div>
      </AdminFormModal>
      
      {/* --- NEW: Confirmation Dialog --- */}
      <ConfirmationDialog
        isOpen={isConfirming}
        onClose={handleCloseConfirm}
        onConfirm={handleConfirmBlackout}
        title="Confirm Blackout"
        message={`This will operationally cancel all tours for "${tour?.name}" from ${startDate} to ${endDate}.\n\nAll existing bookings will be moved to 'Pending Triage'. This action is irreversible.\n\nReason: ${reason}`}
        confirmText="Confirm & Cancel Tours"
        cancelText="Go Back"
        isDestructive={true}
      />
    </>
  );
};

export default BlackoutManagerModal;