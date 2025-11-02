// client/src/adminPortal/MADTourManagement/TourManager/TourEditorModal.jsx
import React, { useState, useEffect } from 'react';
import AdminFormModal from '../../../ui/modals/AdminFormModal.jsx';
import * as adminTourService from '../../../services/admin/adminTourService.js';
import styles from './TourEditorModal.module.css';
import sharedStyles from '../../adminshared.module.css';

// --- Schedule Editor Sub-component ---
const ScheduleEditor = ({ schedule, onScheduleChange }) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleDayToggle = (dayIndex) => {
    const newDays = schedule.days_of_week.includes(dayIndex)
      ? schedule.days_of_week.filter(d => d !== dayIndex)
      : [...schedule.days_of_week, dayIndex];
    onScheduleChange({ ...schedule, days_of_week: newDays.sort() });
  };

  const handleSelectAll = (select) => {
    if (select) {
      onScheduleChange({ ...schedule, days_of_week: [0, 1, 2, 3, 4, 5, 6] });
    } else {
      onScheduleChange({ ...schedule, days_of_week: [] });
    }
  };

  const handleTimeChange = (index, value) => {
    const newTimes = [...schedule.times];
    newTimes[index] = value;
    onScheduleChange({ ...schedule, times: newTimes });
  };

  const addTime = () => {
    onScheduleChange({ ...schedule, times: [...schedule.times, ''] });
  };

  const removeTime = (index) => {
    const newTimes = schedule.times.filter((_, i) => i !== index);
    onScheduleChange({ ...schedule, times: newTimes });
  };

  return (
    <div className={styles.scheduleEditor}>
      <div className={sharedStyles.formGroup}>
        <label>Days of Week</label>
        <div className={styles.dayCheckboxes}>
          {days.map((day, index) => (
            <button
              type="button"
              key={day}
              className={`${styles.dayButton} ${schedule.days_of_week.includes(index) ? styles.daySelected : ''}`}
              onClick={() => handleDayToggle(index)}
            >
              {day}
            </button>
          ))}
        </div>
        <div className={styles.dayActions}>
          <button type="button" className={sharedStyles.secondaryButtonSmall} onClick={() => handleSelectAll(true)}>All Days</button>
          <button type="button" className={sharedStyles.secondaryButtonSmall} onClick={() => handleSelectAll(false)}>Clear All</button>
        </div>
      </div>

      <div className={sharedStyles.formGroup}>
        <label>Times (HH:MM 24-hour)</label>
        <div className={styles.timeList}>
          {schedule.times.map((time, index) => (
            <div key={index} className={styles.timeInputRow}>
              <input
                type="time"
                value={time}
                onChange={(e) => handleTimeChange(index, e.target.value)}
                className={sharedStyles.input}
              />
              <button
                type="button"
                onClick={() => removeTime(index)}
                className={styles.removeTimeBtn}
              >
                &times;
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addTime}
            className={sharedStyles.secondaryButtonSmall}
          >
            + Add Time
          </button>
        </div>
      </div>
    </div>
  );
};

const TourEditorModal = ({ isOpen, onClose, tour, onSaveSuccess, onSaveError }) => {
  const [activeTab, setActiveTab] = useState('details');
  const [formData, setFormData] = useState({});
  const [scheduleConfig, setScheduleConfig] = useState(null);
  const [currentScheduleId, setCurrentScheduleId] = useState(null);
  const [loading, setLoading] = useState(false);

  const isCreating = !tour;
  const modalTitle = isCreating ? 'Create New Tour' : 'Edit Tour';

  const defaultSchedule = {
    schedule: {
      days_of_week: [1, 2, 3, 4, 5, 6, 0],
      times: ['09:00', '11:00', '13:00', '15:00'],
      blackout_ranges: []
    },
    pricing: {
      adult: 100,
      child: 50,
      pensioner: 80,
      family: 300
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab('details');
      
      if (isCreating) {
        setFormData({
          name: 'New Tour',
          description: '',
          duration_minutes: 60,
          base_price: 100,
          capacity: 15,
          booking_window_days: 90,
          active: false
        });
        setScheduleConfig(defaultSchedule);
        setCurrentScheduleId(null);
      } else {
        setFormData({
          name: tour.name,
          description: tour.description,
          duration_minutes: tour.duration_minutes,
          base_price: tour.base_price,
          capacity: tour.capacity,
          booking_window_days: tour.booking_window_days,
          active: tour.active
        });
        loadSchedule();
      }
    }
  }, [isOpen, tour]);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const schedules = await adminTourService.getSchedulesForTour(tour.id);
      const activeSchedule = schedules.find(s => s.active);
      
      if (activeSchedule) {
        setCurrentScheduleId(activeSchedule.id);
        setScheduleConfig({
          schedule: {
            ...defaultSchedule.schedule,
            ...activeSchedule.schedule_config.schedule,
            blackout_ranges: activeSchedule.schedule_config.schedule?.blackout_ranges || []
          },
          pricing: {
            ...defaultSchedule.pricing,
            ...activeSchedule.schedule_config.pricing
          }
        });
      } else {
        setCurrentScheduleId(null);
        setScheduleConfig(defaultSchedule);
      }
    } catch (err) {
      if (onSaveError) {
        onSaveError(`Failed to load schedule: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalValue;

    if (type === 'checkbox') {
      finalValue = checked;
    } else if (name === 'active') {
      // Convert string 'true'/'false' to boolean
      finalValue = value === 'true';
    } else {
      finalValue = value;
    }

    setFormData(prev => ({
      ...prev,
      [name]: finalValue
    }));
  };

  const handlePricingChange = (e) => {
    const { name, value } = e.target;
    setScheduleConfig(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        [name]: parseFloat(value) || 0
      }
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    
    try {
      let savedTour;
      if (isCreating) {
        savedTour = await adminTourService.createTour(formData);
      } else {
        savedTour = await adminTourService.updateTour(tour.id, formData);
      }
      
      const configToSave = { ...scheduleConfig };

      if (currentScheduleId) {
        await adminTourService.updateSchedule(currentScheduleId, configToSave);
      } else {
        await adminTourService.createSchedule(savedTour.id, configToSave);
      }

      setLoading(false);
      onSaveSuccess(isCreating ? 'Tour created!' : 'Tour updated!');
      
    } catch (err) {
      setLoading(false);
      if (onSaveError) {
        onSaveError(err.message || 'Failed to save tour');
      }
    }
  };

  return (
    <AdminFormModal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <div className={styles.tabContainer}>
        <button 
          className={`${styles.tabButton} ${activeTab === 'details' ? styles.active : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'schedule' ? styles.active : ''}`}
          onClick={() => setActiveTab('schedule')}
          disabled={isCreating}
          title={isCreating ? "Save the tour first to enable" : ""}
        >
          Schedule
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'pricing' ? styles.active : ''}`}
          onClick={() => setActiveTab('pricing')}
          disabled={isCreating}
          title={isCreating ? "Save the tour first to enable" : ""}
        >
          Pricing
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'media' ? styles.active : ''}`}
          onClick={() => setActiveTab('media')}
          disabled={isCreating}
          title={isCreating ? "Save the tour first to enable" : ""}
        >
          Media
        </button>
      </div>

      <div className={styles.tabContent}>
        {loading && (
          <div className={sharedStyles.loadingContainer}>
            <div className={sharedStyles.spinner}></div>
          </div>
        )}

        {activeTab === 'details' && !loading && (
          <form>
            <div className={styles.grid}>
              <div className={sharedStyles.formGroup}>
                <label>Tour Name</label>
                <input type="text" name="name" value={formData.name || ''} onChange={handleFormChange} className={sharedStyles.input} />
              </div>
              <div className={sharedStyles.formGroup}>
                <label>Base Price (Fallback)</label>
                <input type="number" step="0.01" name="base_price" value={formData.base_price || 0} onChange={handleFormChange} className={sharedStyles.input} />
              </div>
              <div className={sharedStyles.formGroup}>
                <label>Duration (minutes)</label>
                <input type="number" name="duration_minutes" value={formData.duration_minutes || 0} onChange={handleFormChange} className={sharedStyles.input} />
              </div>
              <div className={sharedStyles.formGroup}>
                <label>Capacity</label>
                <input type="number" name="capacity" value={formData.capacity || 0} onChange={handleFormChange} className={sharedStyles.input} />
              </div>
              <div className={sharedStyles.formGroup}>
                <label>Booking Window (Days)</label>
                <input type="number" name="booking_window_days" value={formData.booking_window_days || 90} onChange={handleFormChange} className={sharedStyles.input} />
              </div>
              <div className={sharedStyles.formGroup}>
                <label>Status</label>
                <select name="active" value={formData.active ? 'true' : 'false'} onChange={handleFormChange} className={sharedStyles.input}>
                  <option value="true">Active</option>
                  <option value="false">Draft</option>
                </select>
              </div>
            </div>
            <div className={sharedStyles.formGroup}>
              <label>Description</label>
              <textarea name="description" value={formData.description || ''} onChange={handleFormChange} className={sharedStyles.textarea} rows="4" />
            </div>
          </form>
        )}

        {activeTab === 'schedule' && !loading && scheduleConfig && (
          <ScheduleEditor 
            schedule={scheduleConfig.schedule} 
            onScheduleChange={(newSchedule) => setScheduleConfig(p => ({...p, schedule: newSchedule}))}
          />
        )}
        
        {activeTab === 'pricing' && !loading && scheduleConfig && (
          <form className={styles.grid}>
            <p className={sharedStyles.description} style={{ gridColumn: '1 / -1'}}>
              Set prices for this schedule. Set to 0 to disable.
            </p>
            <div className={sharedStyles.formGroup}>
              <label>Adult Price</label>
              <input type="number" step="0.01" name="adult" value={scheduleConfig.pricing.adult} onChange={handlePricingChange} className={sharedStyles.input} />
            </div>
            <div className={sharedStyles.formGroup}>
              <label>Child Price</label>
              <input type="number" step="0.01" name="child" value={scheduleConfig.pricing.child} onChange={handlePricingChange} className={sharedStyles.input} />
            </div>
            <div className={sharedStyles.formGroup}>
              <label>Pensioner Price</label>
              <input type="number" step="0.01" name="pensioner" value={scheduleConfig.pricing.pensioner} onChange={handlePricingChange} className={sharedStyles.input} />
            </div>
            <div className={sharedStyles.formGroup}>
              <label>Family Price (2A, 2C)</label>
              <input type="number" step="0.01" name="family" value={scheduleConfig.pricing.family} onChange={handlePricingChange} className={sharedStyles.input} />
            </div>
          </form>
        )}
        
        {activeTab === 'media' && !loading && (
          <div>
            <p className={sharedStyles.description}>
              Upload images for your tour. The first image will be the cover.
            </p>
            <div className={styles.uploadPlaceholder}>
              Custom file upload component will go here.
            </div>
          </div>
        )}
      </div>

      <div className={sharedStyles.formFooter}>
        <button 
          type="button" 
          className={sharedStyles.secondaryButton}
          onClick={onClose}
        >
          Cancel
        </button>
        <button 
          type="button" 
          className={sharedStyles.primaryButton}
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </AdminFormModal>
  );
};

export default TourEditorModal;