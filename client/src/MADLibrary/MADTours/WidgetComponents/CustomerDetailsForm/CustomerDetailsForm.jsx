// ==========================================
// client/src/MADLibrary/MADTours/WidgetComponents/CustomerDetailsForm/CustomerDetailsForm.jsx
// ==========================================

import React from 'react';
// --- [NEW] Import the Markdown Editor ---
import MarkdownEditor from '../../../admin/MarkdownEditor/MarkdownEditor.jsx';
import styles from './CustomerDetailsForm.module.css';
import sharedStyles from '../../Widgets/TicketBookingWidget/TicketBookingWidget.module.css';

const CustomerDetailsForm = ({ 
  customer, 
  onCustomerChange, 
  isPayerAPassenger, 
  onPayerToggle, 
  // --- [NEW] Add new props for notes ---
  customerNotes,
  onCustomerNotesChange,
  // ---
  onSubmit, 
  totalAmount, 
  isLoading 
}) => {
  return (
    <div className={sharedStyles.stepContent}>
      <h4 className={sharedStyles.stepTitle}>Your Details</h4>
      
      {/* --- Customer Form Grid (Unchanged) --- */}
      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label>First Name</label>
          <input type="text" name="firstName" value={customer.firstName} onChange={onCustomerChange} className={sharedStyles.input} required />
        </div>
        <div className={styles.formGroup}>
          <label>Last Name</label>
          <input type="text" name="lastName" value={customer.lastName} onChange={onCustomerChange} className={sharedStyles.input} required />
        </div>
        <div className={styles.formGroup}>
          <label>Email</label>
          <input type="email" name="email" value={customer.email} onChange={onCustomerChange} className={sharedStyles.input} required />
        </div>
        <div className={styles.formGroup}>
          <label>Phone</label>
          <input type="tel" name="phone" value={customer.phone} onChange={onCustomerChange} className={sharedStyles.input} required />
        </div>
      </div>

      {/* --- [NEW] Customer Notes Editor --- */}
      <div className={styles.formGroup} style={{ marginTop: '1.5rem' }}>
        <label>Notes / Special Requests (Optional)</label>
        <MarkdownEditor
          value={customerNotes}
          onChange={onCustomerNotesChange}
          disabled={isLoading}
        />
      </div>
      {/* --- [END NEW] --- */}

      {/* --- Checkbox (Unchanged) --- */}
      <div className={styles.checkboxGroup}>
        <input
          type="checkbox"
          id="isPayerAPassenger"
          checked={isPayerAPassenger}
          onChange={onPayerToggle}
        />
        <label htmlFor="isPayerAPassenger">I am one of the passengers</label>
      </div>

      {/* --- Submit Button (Unchanged) --- */}
      <button 
        className={sharedStyles.bookButton} 
        onClick={onSubmit}
        disabled={isLoading}
      >
        {isLoading ? 'Processing...' : `Confirm Booking ($${totalAmount.toFixed(2)})`}
      </button>
    </div>
  );
};

export default CustomerDetailsForm;