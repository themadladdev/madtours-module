// client/src/ui/MADTours/WidgetComponents/CustomerDetailsForm/CustomerDetailsForm.jsx
import React from 'react';
import styles from './CustomerDetailsForm.module.css';
import sharedStyles from '../../Widgets/TicketBookingWidget/TicketBookingWidget.module.css'; // Borrowing some styles

const CustomerDetailsForm = ({ 
  customer, 
  onCustomerChange, 
  isPayerAPassenger, 
  onPayerToggle, 
  onSubmit, 
  totalAmount, 
  isLoading 
}) => {
  return (
    <div className={sharedStyles.stepContent}>
      <h4 className={sharedStyles.stepTitle}>Your Details</h4>
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

      <div className={styles.checkboxGroup}>
        <input
          type="checkbox"
          id="isPayerAPassenger"
          checked={isPayerAPassenger}
          onChange={onPayerToggle}
        />
        <label htmlFor="isPayerAPassenger">I am one of the passengers</label>
      </div>

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