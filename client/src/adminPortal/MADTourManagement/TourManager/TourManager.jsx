// client/src/adminPortal/MADTourManagement/TourManager/TourManager.jsx
import React, { useState, useEffect } from 'react';
import * as adminTourService from '../../../services/admin/adminTourService.js';
import ConfirmationDialog from '../../../ui/dialogbox/ConfirmationDialog.jsx';
import TourEditorModal from './TourEditorModal.jsx';
import styles from './TourManager.module.css';
import sharedStyles from '../../adminshared.module.css';

const TourManager = () => {
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null); // { type: 'success', message: '...' }
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTour, setSelectedTour] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  useEffect(() => {
    loadTours();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadTours = async () => {
    setLoading(true);
    try {
      const allTours = await adminTourService.getAllTours(false);
      setTours(allTours);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setSelectedTour(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tour) => {
    setSelectedTour(tour);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (e, tour) => {
    e.stopPropagation();
    setShowDeleteConfirm(tour);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedTour(null);
  };

  const handleSaveSuccess = (message) => {
    handleModalClose();
    loadTours();
    setToast({ type: 'success', message });
  };

  // NEW: Error handler for modal
  const handleSaveError = (message) => {
    setToast({ type: 'error', message });
  };

  const handleConfirmDelete = async () => {
    if (!showDeleteConfirm) return;
    setToast(null);
    try {
      await adminTourService.deleteTour(showDeleteConfirm.id);
      loadTours();
      setToast({ type: 'success', message: `Tour "${showDeleteConfirm.name}" deleted.` });
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  if (loading) {
    return (
      <div className={sharedStyles.loadingContainer}>
        <div className={sharedStyles.spinner}></div>
        <span>Loading tours...</span>
      </div>
    );
  }

  return (
    <div className={styles.tourManagerContainer}>
      {toast && (
        <div 
          className={sharedStyles.toastNotification}
          style={{ borderLeftColor: toast.type === 'error' ? 'var(--destructive)' : 'var(--text)' }}
        >
          <p>{toast.message}</p>
          <button onClick={() => setToast(null)}>Close</button>
        </div>
      )}

      <div className={styles.header}>
        <h3>Your Tours</h3>
        <button 
          className={sharedStyles.primaryButton}
          onClick={handleOpenCreate}
        >
          + New Tour
        </button>
      </div>

      <div className={sharedStyles.contentBox}>
        <table className={sharedStyles.table}>
          <thead>
            <tr>
              <th>Tour Name</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Base Price</th>
              <th>Capacity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tours.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                  No tours found. Click "+ New Tour" to begin.
                </td>
              </tr>
            ) : (
              tours.map(tour => (
                <tr key={tour.id} className={styles.tourRow} onClick={() => handleOpenEdit(tour)}>
                  <td className={styles.tourName}>{tour.name}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${tour.active ? styles.active : styles.inactive}`}>
                      {tour.active ? 'Active' : 'Draft'}
                    </span>
                  </td>
                  <td>{tour.duration_minutes} min</td>
                  <td>${tour.base_price}</td>
                  <td>{tour.capacity}</td>
                  <td className={styles.actionsCell}>
                    <button
                      className={sharedStyles.destructiveGhostButtonSmall}
                      onClick={(e) => handleOpenDelete(e, tour)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TourEditorModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        tour={selectedTour}
        onSaveSuccess={handleSaveSuccess}
        onSaveError={handleSaveError}
      />

      <ConfirmationDialog
        isOpen={!!showDeleteConfirm}
        title="Delete Tour"
        message={`Are you sure you want to delete "${showDeleteConfirm?.name}"?\nThis action cannot be undone.`}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={handleConfirmDelete}
        confirmText="Delete"
        isDestructive={true}
      />
    </div>
  );
};

export default TourManager;