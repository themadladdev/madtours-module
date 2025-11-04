// client/src/adminPortal/MADTourManagement/TourManager/TourEditorModal.jsx
import React, { useState, useEffect } from 'react';
import AdminFormModal from '../../../ui/modals/AdminFormModal.jsx';
import * as adminTourService from '../../../services/admin/adminTourService.js';
// --- NEW: Import the ticket service ---
import * as adminTicketService from '../../../services/admin/adminTicketService.js';
import styles from './TourEditorModal.module.css';
import sharedStyles from '../../adminshared.module.css';

// --- Schedule Editor Sub-component (Unchanged) ---
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

// --- NEW: Tour Price Editor Sub-component ---
const TourPriceEditor = ({ allTickets, tourPricing, onPricingChange }) => {
  
  const handlePriceChange = (ticket_id, newPrice) => {
    const priceValue = parseFloat(newPrice) || 0;
    
    // Check if this ticket already has a price rule
    const existingRule = tourPricing.find(p => p.ticket_id === ticket_id);

    let newPricingRules;
    if (existingRule) {
      // Update existing rule
      newPricingRules = tourPricing.map(p =>
        p.ticket_id === ticket_id ? { ...p, price: priceValue } : p
      );
    } else {
      // Add new rule
      newPricingRules = [
        ...tourPricing,
        { ticket_id: ticket_id, price: priceValue }
      ];
    }
    
    // Filter out 0 or empty prices, as the API service skips them anyway
    // This keeps the state clean
    onPricingChange(newPricingRules.filter(p => p.price > 0));
  };

  const getPriceForTicket = (ticket_id) => {
    const rule = tourPricing.find(p => p.ticket_id === ticket_id);
    return rule ? rule.price : '';
  };

  const atomicTickets = allTickets.filter(t => t.type === 'atomic');
  const combinedTickets = allTickets.filter(t => t.type === 'combined');

  const renderPriceList = (tickets) => (
    <div className={styles.priceList}>
      {tickets.map(ticket => (
        <div key={ticket.id} className={styles.priceRow}>
          <label htmlFor={`price-${ticket.id}`}>{ticket.name}</label>
          <div className={styles.priceInputWrapper}>
            <span>$</span>
            <input
              id={`price-${ticket.id}`}
              type="number"
              step="0.01"
              min="0"
              className={sharedStyles.input}
              placeholder="0.00"
              value={getPriceForTicket(ticket.id)}
              onChange={(e) => handlePriceChange(ticket.id, e.target.value)}
            />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className={styles.priceEditorContainer}>
      <p className={sharedStyles.description}>
        Set the "Macro" price for tickets on this tour. Tickets from your "Ticket Library" are shown here. Set price to 0 or leave blank to disable.
      </p>
      
      <h4 className={styles.priceListHeading}>Atomic Tickets</h4>
      {atomicTickets.length > 0 ? (
        renderPriceList(atomicTickets)
      ) : (
        <p className={styles.noTickets}>No atomic tickets found in your library.</p>
      )}

      <h4 className={styles.priceListHeading}>Combined Tickets</h4>
      {combinedTickets.length > 0 ? (
        renderPriceList(combinedTickets)
      ) : (
        <p className={styles.noTickets}>No combined tickets found in your library.</p>
      )}
    </div>
  );
};


// --- Main Modal Component ---
const TourEditorModal = ({ isOpen, onClose, tour, onSaveSuccess, onSaveError }) => {
  const [activeTab, setActiveTab] = useState('details');
  const [formData, setFormData] = useState({});
  const [scheduleConfig, setScheduleConfig] = useState(null);
  const [currentScheduleId, setCurrentScheduleId] = useState(null);
  const [loading, setLoading] = useState(false);

  // --- NEW: State for pricing ---
  const [allTickets, setAllTickets] = useState([]);
  const [tourPricing, setTourPricing] = useState([]);

  const isCreating = !tour;
  const modalTitle = isCreating ? 'Create New Tour' : 'Edit Tour';

  // --- REFACTORED: Default schedule no longer contains pricing ---
  const defaultSchedule = {
    schedule: {
      days_of_week: [1, 2, 3, 4, 5, 6, 0],
      times: ['09:00', '11:00', '13:00', '15:00'],
      blackout_ranges: []
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
          base_price: 0, // Base price is now a fallback, set to 0
          capacity: 15,
          booking_window_days: 90,
          active: false
        });
        setScheduleConfig(defaultSchedule);
        setCurrentScheduleId(null);
        // We don't load pricing for a new tour
        setAllTickets([]);
        setTourPricing([]);
      } else {
        setFormData({
          name: tour.name,
          description: tour.description,
          duration_minutes: tour.duration_minutes,
          base_price: tour.base_price, // Keep existing fallback
          capacity: tour.capacity,
          booking_window_days: tour.booking_window_days,
          active: tour.active
        });
        // Load both schedule and pricing data
        loadSchedule();
        loadPricingData();
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
        // --- REFACTORED: Only set schedule, ignore old pricing object ---
        setScheduleConfig({
          schedule: {
            ...defaultSchedule.schedule,
            ...activeSchedule.schedule_config.schedule,
            blackout_ranges: activeSchedule.schedule_config.schedule?.blackout_ranges || []
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
      setLoading(false); // Pricing load will manage its own loading
    }
  };

  // --- NEW: Function to load all pricing data ---
  const loadPricingData = async () => {
    setLoading(true);
    try {
      // Load all ticket definitions and this tour's specific price rules
      const [allTicketsData, tourPricingData] = await Promise.all([
        adminTicketService.getAllTicketDefinitions(),
        adminTicketService.getPricingForTour(tour.id)
      ]);
      
      setAllTickets(allTicketsData);
      setTourPricing(tourPricingData);
      
    } catch (err) {
      if (onSaveError) {
        onSaveError(`Failed to load pricing data: ${err.message}`);
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
      finalValue = value === 'true';
    } else {
      finalValue = value;
    }

    setFormData(prev => ({
      ...prev,
      [name]: finalValue
    }));
  };

  // --- REMOVED: handlePricingChange is gone ---

  const handleSave = async () => {
    setLoading(true);
    
    try {
      // --- Step 1: Save Tour Details ---
      let savedTour;
      if (isCreating) {
        savedTour = await adminTourService.createTour(formData);
      } else {
        savedTour = await adminTourService.updateTour(tour.id, formData);
      }
      
      // --- Step 2: Save Schedule ---
      // REFACTORED: We now ONLY save the 'schedule' object to the JSONB
      const configToSave = { 
        schedule: scheduleConfig.schedule 
      };

      if (currentScheduleId) {
        await adminTourService.updateSchedule(currentScheduleId, configToSave);
      } else {
        // This is a new tour, create the schedule
        await adminTourService.createSchedule(savedTour.id, configToSave);
      }

      // --- NEW: Step 3: Save Pricing ---
      // This saves the pricing rules to the new 'tour_pricing' table
      if (!isCreating) {
        await adminTicketService.setPricingForTour(savedTour.id, tourPricing);
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
          // --- FIX: <form> changed to <div> ---
          <div>
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
          </div>
        )}

        {activeTab === 'schedule' && !loading && scheduleConfig && (
          <ScheduleEditor 
            schedule={scheduleConfig.schedule} 
            onScheduleChange={(newSchedule) => setScheduleConfig(p => ({...p, schedule: newSchedule}))}
          />
        )}
        
        {/* --- REFACTORED: Pricing Tab --- */}
        {activeTab === 'pricing' && !loading && (
          <TourPriceEditor
            allTickets={allTickets}
            tourPricing={tourPricing}
            onPricingChange={setTourPricing}
          />
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