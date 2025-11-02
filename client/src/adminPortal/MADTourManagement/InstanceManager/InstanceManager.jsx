// client/src/adminPortal/MADTourManagement/InstanceManager/InstanceManager.jsx
import React, { useState, useEffect } from 'react';
// NEW IMPORT: We need all tours for the dropdown
import { getTourInstances, cancelTourInstance, getAllTours } from '../../../services/admin/adminTourService.js';
import ConfirmationDialog from '../../../ui/dialogbox/ConfirmationDialog.jsx';
import BlackoutManagerModal from './BlackoutManagerModal.jsx'; // --- NEW IMPORT ---
import styles from './InstanceManager.module.css';
import sharedStyles from '../../adminshared.module.css'; 

const InstanceManager = () => {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tours, setTours] = useState([]); // --- NEW: For tour selector
  const [selectedTourId, setSelectedTourId] = useState(''); // --- NEW: For tour selector
  
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    status: 'scheduled'
  });
  
  const [cancelDialog, setCancelDialog] = useState({ instance: null });
  const [cancelReason, setCancelReason] = useState('');
  
  // --- NEW: State for Blackout Modal ---
  const [isBlackoutModalOpen, setIsBlackoutModalOpen] = useState(false);

  useEffect(() => {
    // Load the list of tours for the dropdown
    const loadTours = async () => {
      try {
        const toursData = await getAllTours(false); // Get all tours, not just active
        setTours(toursData);
        if (toursData.length > 0) {
          setSelectedTourId(toursData[0].id); // Select the first tour by default
        }
      } catch (error) {
        console.error('Error loading tours:', error);
      }
    };
    loadTours();
  }, []);

  useEffect(() => {
    // Only load instances if a tour is selected
    if (selectedTourId) {
      loadInstances();
    } else {
      setInstances([]);
      setLoading(false);
    }
  }, [filters, selectedTourId]); // Reload when tour selection changes

  const loadInstances = async () => {
    setLoading(true);
    try {
      // Add the selectedTourId to the filters
      const data = await getTourInstances({
        ...filters,
        tourId: selectedTourId 
      });
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
  
  const selectedTour = tours.find(t => t.id === parseInt(selectedTourId));

  return (
    <div className={styles.instanceManager}>
      {/* --- REFACTORED: Filter box now has Tour Selector and Blackout Button --- */}
      <div className={`${sharedStyles.filterBox} ${styles.filterBar}`}>
        <div className={sharedStyles.filterGroup} style={{ minWidth: '250px' }}>
          <label htmlFor="tour-selector">Tour</label>
          <select
            id="tour-selector"
            className={sharedStyles.input}
            value={selectedTourId}
            onChange={(e) => setSelectedTourId(e.target.value)}
          >
            <option value="">-- Select a Tour --</option>
            {tours.map(tour => (
              <option key={tour.id} value={tour.id}>{tour.name}</option>
            ))}
          </select>
        </div>
        
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
        
        {/* --- NEW: Manage Blackouts Button --- */}
        <div className={sharedStyles.filterGroup} style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className={sharedStyles.secondaryButton}
            onClick={() => setIsBlackoutModalOpen(true)}
            disabled={!selectedTourId}
          >
            Manage Blackouts
          </button>
        </div>
      </div>

      {/* --- REFACTORED: Replaced card list with a table --- */}
      <div className={sharedStyles.contentBox}>
        <table className={sharedStyles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Status</th>
              <th>Booked</th>
              <th>Capacity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className={sharedStyles.spinner}></div>
                </td>
              </tr>
            ) : instances.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                  {selectedTourId ? "No tour instances found for these filters." : "Please select a tour to view instances."}
                </td>
              </tr>
            ) : (
              instances.map(instance => (
                <tr key={instance.id}>
                  <td>{new Date(instance.date).toLocaleDateString()}</td>
                  <td>{instance.time}</td>
                  <td>
                    <span className={`${styles.status} ${styles[instance.status]}`}>
                      {instance.status}
                    </span>
                  </td>
                  <td>{instance.booked_seats}</td>
                  <td>{instance.capacity}</td>
                  <td className={styles.actionsCell}>
                    {instance.status === 'scheduled' && (
                      <button
                        onClick={() => handleCancelClick(instance)}
                        className={sharedStyles.destructiveButtonSmall}
                        disabled={instance.booked_seats === 0}
                        title={instance.booked_seats === 0 ? "Cannot cancel a tour with no bookings" : "Cancel tour and refund all bookings"}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
      
      {/* --- NEW: Blackout Manager Modal --- */}
      <BlackoutManagerModal
        isOpen={isBlackoutModalOpen}
        onClose={() => setIsBlackoutModalOpen(false)}
        tour={selectedTour}
      />
    </div>
  );
};

export default InstanceManager;