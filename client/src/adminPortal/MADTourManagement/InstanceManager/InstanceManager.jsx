// client/src/adminPortal/MADTourManagement/InstanceManager/InstanceManager.jsx
import React, { useState, useEffect } from 'react';
import { 
  getTourInstances, 
  getAllTours,
  operationalCancelInstance,
  reInstateInstance
} from '../../../services/admin/adminTourService.js';
import ConfirmationDialog from '../../../ui/dialogbox/ConfirmationDialog.jsx';
import BlackoutManagerModal from './BlackoutManagerModal.jsx';
import PriceManagerModal from './PriceManagerModal.jsx'; 
import styles from './InstanceManager.module.css';
import sharedStyles from '../../adminshared.module.css'; 

const InstanceManager = () => {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tours, setTours] = useState([]);
  const [selectedTourId, setSelectedTourId] = useState('');
  
  const [toast, setToast] = useState(null);
  
  const today = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState({
    startDate: today,
    endDate: today, 
    status: ''
  });
  
  const [cancelDialog, setCancelDialog] = useState({ instance: null });
  const [reInstateDialog, setReInstateDialog] = useState({ instance: null });
  
  const [cancelReason, setCancelReason] = useState('');
  
  const [isBlackoutModalOpen, setIsBlackoutModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false); 

  // --- NEW: Custom navigation handler ---
  const handleNavigate = (event, path) => {
    event.preventDefault();
    window.history.pushState({}, '', path);
    const navigationEvent = new CustomEvent('route-change');
    window.dispatchEvent(navigationEvent);
  };

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
        setToast({ type: 'error', message: 'Failed to load tours.' });
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
  
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadInstances = async () => {
    setLoading(true);
    setToast(null); 
    try {
      const effectiveFilters = {
        ...filters,
        endDate: filters.endDate || filters.startDate,
      };

      const data = await getTourInstances({
        ...effectiveFilters,
        tourId: selectedTourId 
      });
      setInstances(data);
    } catch (error) {
      console.error('Error loading instances:', error);
      setToast({ type: 'error', message: 'Failed to load tour instances.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelClick = (instance) => {
    setCancelDialog({ instance: instance });
    setCancelReason('');
  };

  const handleReInstateClick = (instance) => {
    setReInstateDialog({ instance: instance });
  };

  const handleCloseDialogs = () => {
    setCancelDialog({ instance: null });
    setReInstateDialog({ instance: null });
  };

  const handleMicroPriceEdit = (instance) => {
    setToast({ type: 'info', message: 'Price editing is not yet implemented.' });
  };

  // --- NEW: Manifest button handler ---
  const handleViewManifest = (e, instanceId) => {
    e.stopPropagation(); // Stop the row's click event
    handleNavigate(e, `/admin/tours/manifest/${instanceId}`);
  };

  const handleConfirmCancel = async () => {
    const { instance } = cancelDialog;

    if (!cancelReason) {
      setToast({ type: 'error', message: 'A cancellation reason is required.' });
      return; 
    }
    
    setToast(null); 

    try {
      await operationalCancelInstance({
        tourId: instance.tour_id,
        date: instance.date,
        time: instance.time,
        reason: cancelReason,
        capacity: instance.capacity
      });
      
      setToast({ type: 'success', message: 'Tour successfully cancelled.' });
      handleCloseDialogs();
      await loadInstances();

    } catch (error) {
      console.error('Error performing operational cancellation:', error);
      setToast({ type: 'error', message: error.message || 'Failed to cancel tour' });
    }
  };

  const handleConfirmReInstate = async () => {
    const { instance } = reInstateDialog;
    try {
      await reInstateInstance({
        tourId: instance.tour_id,
        date: instance.date,
        time: instance.time,
      });

      setToast({ type: 'success', message: 'Tour successfully re-instated.' });
      handleCloseDialogs();
      await loadInstances();

    } catch (error)
    {
      console.error('Error re-instating tour:', error);
      setToast({ type: 'error', message: error.message || 'Failed to re-instate tour' });
    }
  };
  
  const handleBlackoutSuccess = (result) => {
    console.log('Blackout success, refreshing instances:', result);
    setIsBlackoutModalOpen(false);
    loadInstances();
    setToast({ type: 'success', message: 'Blackout range has been updated.' });
  };
  
  const selectedTour = tours.find(t => t.id === parseInt(selectedTourId));

  return (
    <div className={styles.instanceManager}>
      
      {toast && (
        <div 
          className={sharedStyles.toastNotification}
          style={{ 
            borderLeftColor: toast.type === 'error' ? 'var(--destructive)' : (toast.type === 'info' ? 'var(--grey-700)' : 'var(--text)'),
            backgroundColor: toast.type === 'info' ? 'var(--grey-100)' : 'var(--background)'
          }}
        >
          <p>{toast.message}</p>
          <button onClick={() => setToast(null)}>Close</button>
        </div>
      )}
      
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
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value, endDate: e.target.value })}
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
            min={filters.startDate}
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
              <th className={styles.textLeft}>Date</th>
              <th className={styles.textCenter}>Time</th>
              <th className={styles.textCenter}>Status</th>
              <th className={styles.textCenter}>Booked</th>
              <th className={styles.textCenter}>Capacity</th>
              <th className={styles.textCenter}>Actions (Micro)</th>
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
                <tr key={instance.id || `gen-${instance.date}-${instance.time}`}>
                  <td className={styles.textLeft}>{new Date(instance.date).toLocaleDateString()}</td>
                  <td className={styles.textCenter}>{instance.time.substring(0, 5)}</td>
                  <td className={styles.textCenter}>
                    <span className={`${styles.status} ${styles[instance.status]}`}>
                      {instance.status}
                    </span>
                  </td>
                  <td className={styles.textCenter}>{instance.booked_seats}</td>
                  <td className={styles.textCenter}>{instance.capacity}</td>
                  <td className={styles.actionsCell}>
                    
                    {/* --- NEW: View Manifest Button --- */}
                    {instance.id && instance.booked_seats > 0 && (
                      <button
                        onClick={(e) => handleViewManifest(e, instance.id)}
                        className={sharedStyles.secondaryButtonSmall}
                        style={{ marginRight: '0.5rem' }}
                      >
                        Manifest
                      </button>
                    )}
                    
                    {instance.status === 'scheduled' && (
                      <>
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
                          title="Cancel tour and move bookings to pending"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    
                    {instance.status === 'cancelled' && (
                      <button
                        onClick={() => handleReInstateClick(instance)}
                        className={sharedStyles.primaryButtonSmall}
                        title="Re-instate tour and re-confirm pending bookings"
                      >
                        Re-instate
                      </button>
                    )}
                    
                    {instance.status === 'completed' && (
                      <span>(Completed)</span>
                    )}
                    
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- Cancel Dialog --- */}
      <ConfirmationDialog
        isOpen={!!cancelDialog.instance}
        title="Cancel Tour Instance"
        message={`Are you sure you want to cancel this tour? ${cancelDialog.instance?.booked_seats || 0} existing bookings will be moved to the "Pending Resolution" queue.`}
        onConfirm={handleConfirmCancel}
        onClose={handleCloseDialogs}
        confirmText="Confirm Cancellation"
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
            />
          </div>
        </div>
      </ConfirmationDialog>
      
      {/* --- Re-instate Dialog --- */}
      <ConfirmationDialog
        isOpen={!!reInstateDialog.instance}
        title="Re-instate Tour Instance"
        message={`Are you sure you want to re-instate this tour for ${new Date(reInstateDialog.instance?.date || '').toLocaleDateString()} at ${reInstateDialog.instance?.time.substring(0, 5)}?\n\nAll bookings still in 'Pending Resolution' will be automatically re-confirmed.`}
        onConfirm={handleConfirmReInstate}
        onClose={handleCloseDialogs}
        confirmText="Re-instate Tour"
        cancelText="Go Back"
        isDestructive={false}
      >
      </ConfirmationDialog>
      
      {/* --- FIX: Pass the boolean variable directly --- */}
      <BlackoutManagerModal
        isOpen={isBlackoutModalOpen}
        onClose={() => setIsBlackoutModalOpen(false)}
        onSuccess={handleBlackoutSuccess}
        tour={selectedTour}
      />
      
      <PriceManagerModal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        tour={selectedTour}
      />
    </div>
  );
};

export default InstanceManager;