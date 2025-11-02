// client/src/adminPortal/MADTourManagement/InstanceManager/InstanceManager.jsx
import React, { useState, useEffect } from 'react';
import { getTourInstances, cancelTourInstance, getAllTours } from '../../../services/admin/adminTourService.js';
import ConfirmationDialog from '../../../ui/dialogbox/ConfirmationDialog.jsx';
import BlackoutManagerModal from './BlackoutManagerModal.jsx';
import PriceManagerModal from './PriceManagerModal.jsx'; // --- NEW STUBBED MODAL ---
import styles from './InstanceManager.module.css';
import sharedStyles from '../../adminshared.module.css'; 

const InstanceManager = () => {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tours, setTours] = useState([]);
  const [selectedTourId, setSelectedTourId] = useState('');
  
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    status: 'scheduled'
  });
  
  const [cancelDialog, setCancelDialog] = useState({ instance: null });
  const [cancelReason, setCancelReason] = useState('');
  
  const [isBlackoutModalOpen, setIsBlackoutModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false); // --- NEW ---

  useEffect(() => {
    const loadTours = async () => {
      try {
        const toursData = await getAllTours(false);
        setTours(toursData);
        if (toursData.length > 0) {
          setSelectedTourId(toursData[0].id);
        }
      } catch (error) {
        console.error('Error loading tours:', error);
      }
    };
    loadTours();
  }, []);

  useEffect(() => {
    if (selectedTourId) {
      loadInstances();
    } else {
      setInstances([]);
      setLoading(false);
    }
  }, [filters, selectedTourId]);

  const loadInstances = async () => {
    setLoading(true);
    try {
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

  // --- STUBBED: Micro Price Edit ---
  const handleMicroPriceEdit = (instance) => {
    alert(`STUB: Open modal to edit price for instance ${instance.id}. You can fix this.`);
  };

  const handleConfirmCancel = async () => {
    if (!cancelReason) {
      alert('Cancellation reason is required.');
      return;
    }
    try {
      await cancelTourInstance(cancelDialog.instance.id, cancelReason);
      handleCloseDialog();
      loadInstances(); 
      alert('Tour cancelled successfully. All customers will be notified and refunded.');
    } catch (error) {
      console.error('Error cancelling tour:', error);
      alert('Failed to cancel tour: ' + error.message);
    }
  };
  
  const selectedTour = tours.find(t => t.id === parseInt(selectedTourId));

  return (
    <div className={styles.instanceManager}>
      
      {/* --- ROW 1: MACRO CONTROLS --- */}
      <div className={`${sharedStyles.filterBox} ${styles.macroBar}`}>
        <div className={sharedStyles.filterGroup} style={{ minWidth: '250px' }}>
          <label htmlFor="tour-selector">Selected Tour (Macro Controls)</label>
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
        <div className={sharedStyles.filterGroup} style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className={sharedStyles.secondaryButton}
            onClick={() => setIsBlackoutModalOpen(true)}
            disabled={!selectedTourId}
          >
            Manage Blackouts (Macro)
          </button>
        </div>
        <div className={sharedStyles.filterGroup} style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className={sharedStyles.secondaryButton}
            onClick={() => setIsPriceModalOpen(true)}
            disabled={!selectedTourId}
          >
            Manage Pricing (Macro)
          </button>
        </div>
      </div>
      
      {/* --- ROW 2: FILTERS --- */}
      <div className={`${sharedStyles.filterBox} ${styles.filterBar}`}>
        <div className={sharedStyles.filterGroup}>
          <label htmlFor="filter-start-date">Date From</label>
          <input
            id="filter-start-date"
            type="date"
            className={sharedStyles.input}
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          />
        </div>
        <div className={sharedStyles.filterGroup}>
          <label htmlFor="filter-end-date">Date To</label>
          <input
            id="filter-end-date"
            type="date"
            className={sharedStyles.input}
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          />
        </div>
        <div className={sharedStyles.filterGroup}>
          <label htmlFor="filter-status">Status</label>
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

      {/* --- ROW 3: MICRO-EXCEPTIONS --- */}
      <div className={sharedStyles.contentBox}>
        <table className={sharedStyles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Status</th>
              <th>Booked</th>
              <th>Capacity</th>
              <th>Actions (Micro)</th>
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
                      <>
                        {/* --- STUBBED: Micro Price Edit Button --- */}
                        <button
                          onClick={() => handleMicroPriceEdit(instance)}
                          className={sharedStyles.secondaryButtonSmall}
                          style={{ marginRight: '0.5rem' }}
                        >
                          Edit Price
                        </button>
                        <button
                          onClick={() => handleCancelClick(instance)}
                          className={sharedStyles.destructiveButtonSmall}
                          disabled={instance.booked_seats === 0}
                          title={instance.booked_seats === 0 ? "Cannot cancel" : "Cancel tour and refund all bookings"}
                        >
                          Cancel
                        </button>
                      </>
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
      
      <BlackoutManagerModal
        isOpen={isBlackoutModalOpen}
        onClose={() => setIsBlackoutModalOpen(false)}
        tour={selectedTour}
      />
      
      {/* --- NEW: Stubbed Price Modal --- */}
      <PriceManagerModal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        tour={selectedTour}
      />
    </div>
  );
};

export default InstanceManager;