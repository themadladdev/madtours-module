// client/src/adminPortal/MADTourManagement/InstanceManager/PriceManagerModal.jsx
import React from 'react';
import AdminFormModal from '../../../ui/modals/AdminFormModal.jsx';
import styles from './PriceManagerModal.module.css';
import sharedStyles from '../../adminshared.module.css';

const PriceManagerModal = ({ isOpen, onClose, tour }) => {

  const handleSave = () => {
    alert("STUB: Save pricing logic. You can fix this.");
    onClose();
  };

  return (
    <AdminFormModal isOpen={isOpen} onClose={onClose} title={`Manage Macro Pricing for ${tour?.name}`}>
      
      <div className={styles.priceEditor}>
        <p className={sharedStyles.description}>
          This is a STUBBED component. You can add the UI here to edit the
          fallback (Macro) pricing tiers for this tour's schedule.
        </p>
        
        <div className={sharedStyles.formGroup}>
          <label>Adult Price (STUB)</label>
          <input type="number" className={sharedStyles.input} placeholder="100.00" />
        </div>
        <div className={sharedStyles.formGroup}>
          <label>Child Price (STUB)</label>
          <input type="number" className={sharedStyles.input} placeholder="50.00" />
        </div>
      </div>

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
        >
          Save Prices
        </button>
      </div>
    </AdminFormModal>
  );
};

export default PriceManagerModal;