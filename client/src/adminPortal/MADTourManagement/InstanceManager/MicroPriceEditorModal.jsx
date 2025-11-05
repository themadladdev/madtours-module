// client/src/adminPortal/MADTourManagement/InstanceManager/MicroPriceEditorModal.jsx
import React, { useState, useEffect } from 'react';
import AdminFormModal from '../../../ui/modals/AdminFormModal.jsx';
import * as adminTicketService from '../../../services/admin/adminTicketService.js';
import styles from './MicroPriceEditorModal.module.css';
import sharedStyles from '../../adminshared.module.css';

const MicroPriceEditorModal = ({ isOpen, onClose, onSuccess, instance }) => {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [prices, setPrices] = useState([]);

  useEffect(() => {
    if (isOpen && instance) {
      setLoading(true);
      setToast(null);
      setPrices([]);
      
      const loadPrices = async () => {
        try {
          const pricingData = await adminTicketService.getInstancePricing({
            tourId: instance.tour_id,
            date: instance.date,
            time: instance.time,
            capacity: instance.capacity
          });
          
          const priceState = pricingData.map(p => ({
            ...p,
            input_value: p.exception_price !== null ? p.exception_price : ''
          }));
          
          setPrices(priceState);
          
        } catch (err) {
          console.error('[MicroPriceEditor] Error loading prices:', err);
          setToast({ type: 'error', message: err.message || 'Failed to load pricing.' });
        } finally {
          setLoading(false);
        }
      };
      
      loadPrices();
    }
  }, [isOpen, instance]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  
  const handlePriceChange = (ticketId, value) => {
    // Allow only numbers and a single decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setPrices(currentPrices =>
        currentPrices.map(p =>
          p.ticket_id === ticketId ? { ...p, input_value: value } : p
        )
      );
    }
  };
  
  const handleSave = async () => {
    setLoading(true);
    setToast(null);
    
    const exceptionsToSave = prices
      .map(p => ({
        ticket_id: p.ticket_id,
        price: p.input_value === '' ? null : parseFloat(p.input_value)
      }))
      .filter(p => p.price === null || (!isNaN(p.price) && p.price >= 0));

    try {
      const result = await adminTicketService.setInstancePricing({
        tourId: instance.tour_id,
        date: instance.date,
        time: instance.time,
        capacity: instance.capacity,
        prices: exceptionsToSave
      });
      
      setLoading(false);
      onSuccess(result);
      
    } catch (err) {
      console.error('[MicroPriceEditor] Error saving prices:', err);
      setToast({ type: 'error', message: err.message || 'Failed to save prices.' });
      setLoading(false);
    }
  };

  return (
    <AdminFormModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Edit Micro Pricing`}
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
      
      {instance && (
        <p className={sharedStyles.description}>
          Editing prices for: <strong>{new Date(instance.date).toLocaleDateString()}</strong> at <strong>{instance.time.substring(0, 5)}</strong>.
          <br />
          Set an override price to create a "Micro" exception. Clear the box to use the default "Default" price.
        </p>
      )}

      {/* --- NEW TABLE-BASED LAYOUT --- */}
      <div className={styles.priceEditor}>
        {loading ? (
          <div className={sharedStyles.loadingContainer} style={{ padding: '2rem 0' }}>
            <div className={sharedStyles.spinner}></div>
            <p>Loading prices...</p>
          </div>
        ) : prices.length === 0 ? (
          <div className={sharedStyles.emptyState}>
            <p>No ticket types are assigned to this tour.</p>
          </div>
        ) : (
          <table className={styles.priceTable}>
            <thead>
              <tr>
                <th>Ticket Type</th>
                <th>Default Price</th>
                <th>Override Price</th>
              </tr>
            </thead>
            <tbody>
              {prices.map(p => (
                <tr key={p.ticket_id}>
                  <td>{p.name}</td>
                  <td>${parseFloat(p.rule_price).toFixed(2)}</td>
                  <td>
                    <div className={styles.priceInputWrapper}>
                      <span className={styles.dollarSign}>$</span>
                      <input
                        id={`price-${p.ticket_id}`}
                        type="text"
                        inputMode="decimal" // Provides number pad on mobile
                        className={styles.priceInput} // Use new compact style
                        value={p.input_value}
                        onChange={(e) => handlePriceChange(p.ticket_id, e.target.value)}
                        placeholder="Default"
                        disabled={loading}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {/* --- END NEW LAYOUT --- */}

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
          className={sharedStyles.primaryButton}
          onClick={handleSave}
          disabled={loading || prices.length === 0}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </AdminFormModal>
  );
};

export default MicroPriceEditorModal;