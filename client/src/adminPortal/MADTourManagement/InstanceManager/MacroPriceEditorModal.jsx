// client/src/adminPortal/MADTourManagement/InstanceManager/MacroPriceEditorModal.jsx
import React, { useState, useEffect } from 'react';
import AdminFormModal from '../../../MADLibrary/admin/modals/AdminFormModal.jsx';
import ConfirmationDialog from '../../../MADLibrary/admin/dialogbox/ConfirmationDialog.jsx';
import * as adminTicketService from '../../../services/admin/adminTicketService.js';
// Updated CSS import
import styles from './MacroPriceEditorModal.module.css';
import sharedStyles from '../../../MADLibrary/admin/styles/adminshared.module.css';

// Renamed component
const MacroPriceEditorModal = ({ isOpen, onClose, tour, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(''); // Form validation error

  const today = new Date().toISOString().split('T')[0];
  
  // Form state
  const [ticketId, setTicketId] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [price, setPrice] = useState('');

  // Data
  const [tickets, setTickets] = useState([]);

  // Confirmation dialog
  const [isConfirming, setIsConfirming] = useState(false);

  // Fetch ticket definitions for the dropdown
  useEffect(() => {
    if (isOpen) {
      const loadTickets = async () => {
        setLoading(true);
        try {
          // Only fetch atomic and combined, not the composite internal ones
          const allTickets = await adminTicketService.getAllTicketDefinitions();
          const usableTickets = allTickets.filter(t => t.type === 'atomic' || t.type === 'combined');
          setTickets(usableTickets);
          if (usableTickets.length > 0) {
            setTicketId(usableTickets[0].id);
          }
        } catch (err) {
          console.error('[MacroPriceEditorModal] Error loading tickets:', err);
          setToast({ type: 'error', message: 'Failed to load ticket types.' });
        }
        setLoading(false);
      };
      loadTickets();
    }
  }, [isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStartDate(today);
      setEndDate(today);
      setPrice('');
      setError('');
      setLoading(false);
      setIsConfirming(false);
      setToast(null);
      // Don't reset ticketId, let it default
    }
  }, [isOpen]);

  // Toast auto-clear
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // --- NEW: Correct date logic ---
  const handleStartDateChange = (newStartDate) => {
    setStartDate(newStartDate);
    // If end date is now before start date, update end date
    if (new Date(endDate) < new Date(newStartDate)) {
      setEndDate(newStartDate);
    }
  };

  // --- NEW: Price input handler (removes arrows) ---
  const handlePriceChange = (value) => {
    // Allow only numbers and a single decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setPrice(value);
    }
  };

  const handleApplyClick = () => {
    // Form Validation
    setError('');
    if (!ticketId) {
      setError('A ticket type is required.');
      return;
    }
    if (price === '' || isNaN(price) || parseFloat(price) <= 0) {
      setError('A valid, non-negative price is required.');
      return;
    }
    if (!startDate || !endDate) {
      setError('A valid start and end date are required.');
      return;
    }
    setIsConfirming(true);
  };

  const handleCloseConfirm = () => {
    setIsConfirming(false);
  };

  const handleConfirmAdjustment = async () => {
    setLoading(true);
    setError('');

    const adjustmentData = {
      tourId: tour.id,
      ticketId: parseInt(ticketId, 10),
      startDate,
      endDate,
      price: parseFloat(price)
    };

    console.log('[MacroPriceEditorModal] Applying price adjustment:', adjustmentData);

    try {
      const result = await adminTicketService.applyPriceExceptionBatch(adjustmentData);
      
      console.log('[MacroPriceEditorModal] Success:', result);
      
      setLoading(false);
      setIsConfirming(false);
      onSuccess(result); // Tell parent to refresh (or show success)

    } catch (err) {
      console.error('[MacroPriceEditorModal] Error applying adjustment:', err);
      setToast({ type: 'error', message: err.message || 'Failed to apply price adjustment.' });
      setError('');
      setLoading(false);
      setIsConfirming(false);
    }
  };
  
  const selectedTicketName = tickets.find(t => t.id === parseInt(ticketId))?.name || '...';

  return (
    <>
      <AdminFormModal 
        isOpen={isOpen && !isConfirming} 
        onClose={onClose} 
        title={`Apply Macro Pricing for ${tour?.name}`}
      >
        
        {toast && (
          <div 
            className={sharedStyles.toastNotification}
            style={{ 
              borderLeftColor: toast.type === 'error' ? 'var(--destructive)' : 'var(--text)',
              position: 'absolute',
              top: '1.5rem',
              right: '1.5rem',
              zIndex: 2000
            }}
          >
            <p>{toast.message}</p>
          </div>
        )}
        
        <p className={sharedStyles.description}>
          Apply a price exception for a specific ticket type across a date range.
          This will override the default "Rule" price for all tour instances in this period.
        </p>
        
        <div className={styles.priceForm}>
          <div className={sharedStyles.formGroup} style={{ flexBasis: '100%' }}>
            <label htmlFor="price-ticket-type">Ticket Type (Required)</label>
            <select
              id="price-ticket-type"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              className={sharedStyles.input}
              disabled={loading}
            >
              <option value="">-- Select a Ticket --</option>
              {tickets.map(ticket => (
                <option key={ticket.id} value={ticket.id}>{ticket.name}</option>
              ))}
            </select>
          </div>
          
          <div className={sharedStyles.formGroup}>
            <label htmlFor="price-start-date">Start Date</label>
            <input
              id="price-start-date"
              type="date"
              value={startDate}
              // --- UPDATED: Use new handler ---
              onChange={(e) => handleStartDateChange(e.target.value)}
              className={sharedStyles.input}
              disabled={loading}
            />
          </div>
          
          <div className={sharedStyles.formGroup}>
            <label htmlFor="price-end-date">End Date</label>
            <input
              id="price-end-date"
              type="date"
              value={endDate}
              // --- UPDATED: Min date is now startDate ---
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={sharedStyles.input}
              disabled={loading}
            />
          </div>
          
          <div className={sharedStyles.formGroup} style={{ flexBasis: '100%' }}>
            <label htmlFor="price-override-price">New Override Price (Required)</label>
            {/* --- UPDATED: Changed to type="text" --- */}
            <input
              id="price-override-price"
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => handlePriceChange(e.target.value)}
              className={sharedStyles.input}
              placeholder="e.g., 150.00"
              disabled={loading}
            />
          </div>
        </div>

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
            className={sharedStyles.primaryButton} // Changed to primary
            onClick={handleApplyClick}
            disabled={loading || !tour || !ticketId}
          >
            {loading ? 'Applying...' : 'Apply Price Adjustment'}
          </button>
        </div>
      </AdminFormModal>
      
      <ConfirmationDialog
        isOpen={isConfirming}
        onClose={handleCloseConfirm}
        onConfirm={handleConfirmAdjustment}
        title="Confirm Price Adjustment"
        message={`This will set the price of "${selectedTicketName}" tickets to $${price || '0.00'} for all tours from ${startDate} to ${endDate}.\n\nThis will create/update pricing exceptions for all matching tour instances. Are you sure?`}
        confirmText="Confirm & Apply"
        cancelText="Go Back"
        isDestructive={false}
      />
    </>
  );
};

// Renamed default export
export default MacroPriceEditorModal;