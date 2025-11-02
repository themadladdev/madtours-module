// client/src/adminPortal/MADTourManagement/InstanceManager/BlackoutManagerModal.jsx
import React, { useState, useEffect } from 'react';
import AdminFormModal from '../../../ui/modals/AdminFormModal.jsx';
import * as adminTourService from '../../../services/admin/adminTourService.js';
import styles from './BlackoutManagerModal.module.css';
import sharedStyles from '../../adminshared.module.css';

const BlackoutManagerModal = ({ isOpen, onClose, tour }) => {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const defaultSchedule = {
    schedule: { blackout_ranges: [] },
    pricing: {}
  };

  useEffect(() => {
    if (isOpen && tour) {
      loadSchedule();
    } else {
      setSchedule(null); // Clear state when closed
      setError('');
    }
  }, [isOpen, tour]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadSchedule = async () => {
    setLoading(true);
    setError('');
    try {
      const schedules = await adminTourService.getSchedulesForTour(tour.id);
      const activeSchedule = schedules.find(s => s.active);
      if (activeSchedule) {
        setSchedule(activeSchedule);
      } else {
        setSchedule({ ...defaultSchedule, tour_id: tour.id }); // A shell
      }
    } catch (err) {
      setError(`Failed to load schedule: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBlackoutChange = (newRanges) => {
    setSchedule(prev => ({
      ...prev,
      schedule_config: {
        ...prev.schedule_config,
        schedule: {
          ...prev.schedule_config.schedule,
          blackout_ranges: newRanges
        }
      }
    }));
  };

  const handleAddRange = () => {
    const today = new Date().toISOString().split('T')[0];
    const newRanges = [
      ...(schedule.schedule_config.schedule.blackout_ranges || []),
      { from: today, to: today }
    ];
    handleBlackoutChange(newRanges);
  };

  const handleRemoveRange = (index) => {
    const newRanges = (schedule.schedule_config.schedule.blackout_ranges || []).filter((_, i) => i !== index);
    handleBlackoutChange(newRanges);
  };

  const handleRangeChange = (index, field, value) => {
    const newRanges = [...schedule.schedule_config.schedule.blackout_ranges];
    newRanges[index][field] = value;
    handleBlackoutChange(newRanges);
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      if (!schedule.id) {
        // This schedule doesn't exist yet, create it
        await adminTourService.createSchedule(tour.id, schedule.schedule_config);
      } else {
        // Schedule exists, update it
        await adminTourService.updateSchedule(schedule.id, schedule.schedule_config);
      }
      setLoading(false);
      setToast({ type: 'success', message: 'Blackouts saved!' });
      // Don't close modal on save, let user see success
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <AdminFormModal isOpen={isOpen} onClose={onClose} title={`Manage Blackouts for ${tour?.name}`}>
      {toast && (
        <div 
          className={sharedStyles.toastNotification}
          style={{ 
            borderLeftColor: toast.type === 'error' ? 'var(--destructive)' : 'var(--text)',
            position: 'absolute', // Position inside the modal
            top: '1.5rem',
            right: '1.5rem'
          }}
        >
          <p>{toast.message}</p>
        </div>
      )}

      {loading && (
        <div className={sharedStyles.loadingContainer}>
          <div className={sharedStyles.spinner}></div>
        </div>
      )}

      {error && <p className={sharedStyles.errorText}>{error}</p>}

      {!loading && schedule && (
        <div className={styles.blackoutEditor}>
          <p className={sharedStyles.description}>
            Block out date ranges when this tour will NOT run (e.g., for winter).
          </p>
          <div className={styles.blackoutList}>
            {schedule.schedule_config.schedule.blackout_ranges?.length === 0 && (
              <p>No blackout ranges added.</p>
            )}
            {schedule.schedule_config.schedule.blackout_ranges?.map((range, index) => (
              <div key={index} className={styles.blackoutRow}>
                <div className={sharedStyles.formGroup}>
                  <label>From</label>
                  <input
                    type="date"
                    value={range.from}
                    onChange={(e) => handleRangeChange(index, 'from', e.target.value)}
                    className={sharedStyles.input}
                  />
                </div>
                <div className={sharedStyles.formGroup}>
                  <label>To</label>
                  <input
                    type="date"
                    value={range.to}
                    onChange={(e) => handleRangeChange(index, 'to', e.target.value)}
                    className={sharedStyles.input}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveRange(index)}
                  className={styles.removeTimeBtn}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddRange}
            className={sharedStyles.secondaryButton}
          >
            + Add Blackout Range
          </button>
        </div>
      )}

      <div className={sharedStyles.formFooter}>
        <button 
          type="button" 
          className={sharedStyles.secondaryButton}
          onClick={onClose}
        >
          Close
        </button>
        <button 
          type="button" 
          className={sharedStyles.primaryButton}
          onClick={handleSave}
          disabled={loading || !schedule}
        >
          {loading ? 'Saving...' : 'Save Blackouts'}
        </button>
      </div>
    </AdminFormModal>
  );
};

export default BlackoutManagerModal;