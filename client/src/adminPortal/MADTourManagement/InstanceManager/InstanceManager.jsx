// ==========================================
// ADMIN: Tour Instance Manager (Cancel with refunds)
// client/src/adminPortal/MADTourManagement/InstanceManager/InstanceManager.jsx
// ==========================================

import React, { useState, useEffect } from 'react';
import { getTourInstances, cancelTourInstance } from '../../../services/admin/adminTourService.js';
import ConfirmationDialog from '../../../ui/dialogbox/ConfirmationDialog.jsx';
import styles from './InstanceManager.module.css';
import sharedStyles from '../../adminshared.module.css'; // Import shared styles

const InstanceManager = () => {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    status: 'scheduled'
  });
  
  // --- REFACTORED STATE ---
  // We no longer store 'open'. The dialog is open if 'instance' is not null.
  const [cancelDialog, setCancelDialog] = useState({ instance: null });
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    loadInstances();
  }, [filters]);

  const loadInstances = async () => {
    setLoading(true);
    try {
      const data = await getTourInstances(filters);
      setInstances(data);
    } catch (error) {
      console.error('Error loading instances:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelClick = (instance) => {
    setCancelDialog({ instance: instance });
    setCancelReason('');
  };

  const handleCloseDialog = () => {
    setCancelDialog({ instance: null });
  };

  const handleConfirmCancel = async () => {
    if (!cancelReason) {
      alert('Cancellation reason is required.');
      return;
    }

    try {
      await cancelTourInstance(cancelDialog.instance.id, cancelReason);
      handleCloseDialog();
      loadInstances(); // Reload list
      alert('Tour cancelled successfully. All customers will be notified and refunded.');
    } catch (error) {
      console.error('Error cancelling tour:', error);
      alert('Failed to cancel tour: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className={sharedStyles.loadingContainer}>
        <div className={sharedStyles.spinner}></div>
        <span>Loading calendar...</span>
      </div>
    );
  }

  return (
    <div className={styles.instanceManager}>
      {/* <h1> HAS BEEN REMOVED - Handled by wrapper */}

      <div className={sharedStyles.filterBox}>
        <div className={sharedStyles.filterGroup}>
          <label htmlFor="filter-start-date">Start Date:</label>
          <input
            id="filter-start-date"
            type="date"
            className={sharedStyles.input}
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          />
        </div>
        <div className={sharedStyles.filterGroup}>
          <label htmlFor="filter-end-date">End Date:</label>
          <input
            id="filter-end-date"
            type="date"
            className={sharedStyles.input}
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          />
        </div>
        <div className={sharedStyles.filterGroup}>
          <label htmlFor="filter-status">Status:</label>
          <select
            id="filter-status"
            className={sharedStyles.input}
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div className={styles.instancesList}>
        {instances.length === 0 ? (
          <div className={sharedStyles.emptyState}>
            <p>No tour instances found for these filters.</p>
          </div>
        ) : (
          instances.map(instance => (
            <div key={instance.id} className={styles.instanceCard}>
              <div className={styles.instanceHeader}>
                <h3>{instance.tour_name}</h3>
                <span className={`${styles.status} ${styles[instance.status]}`}>
                  {instance.status}
                </span>
              </div>

              <div className={styles.instanceDetails}>
                <p><strong>Date:</strong> {new Date(instance.date).toLocaleDateString()}</p>
                <p><strong>Time:</strong> {instance.time}</p>
                <p><strong>Booked:</strong> {instance.booked_seats}/{instance.capacity}</p>
                <p><strong>Available:</strong> {instance.available_seats} seats</p>
              </div>

              {instance.status === 'scheduled' && (
                <div className={styles.actions}>
                  <button
                    onClick={() => handleCancelClick(instance)}
                    className={sharedStyles.destructiveButton}
                    disabled={instance.booked_seats === 0}
                    title={instance.booked_seats === 0 ? "Cannot cancel a tour with no bookings" : "Cancel tour and refund all bookings"}
                  >
                    Cancel Tour
                  </button>
                </div>
              )}

              {instance.status === 'cancelled' && (
                <div className={styles.cancellationInfo}>
                  <p><strong>Cancelled:</strong> {new Date(instance.cancelled_at).toLocaleString()}</p>
                  <p><strong>Reason:</strong> {instance.cancellation_reason}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* --- REFACTORED DIALOG ---
        The component is now rendered permanently and controls its
        own visibility via the 'isOpen' prop.
      */}
      <ConfirmationDialog
        isOpen={!!cancelDialog.instance}
        title="Cancel Tour Instance"
        message={`Are you sure you want to cancel this tour?\nAll ${cancelDialog.instance?.booked_seats} confirmed bookings will be automatically refunded and customers will be notified by email.`}
        onConfirm={handleConfirmCancel}
        onClose={handleCloseDialog}
        confirmText="Cancel Tour & Refund"
        cancelText="Go Back"
        isDestructive={true}
      >
        {/* Children prop is used for the form inside the dialog */}
        <div className={styles.cancelForm}>
          <div className={sharedStyles.formGroup}>
            <label htmlFor="cancel-reason">Cancellation Reason (required):</label>
            <textarea
              id="cancel-reason"
              className={sharedStyles.textarea}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g., Bad weather forecast, mechanical issues, etc."
              rows="3"
              required
            />
          </div>
        </div>
      </ConfirmationDialog>
    </div>
  );
};

export default InstanceManager;