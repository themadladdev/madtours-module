// client/src/MADLibrary/MADTours/WidgetComponents/AdminCustomerDetails/AdminCustomerDetails.jsx
import React from 'react';
import MarkdownEditor from '../../../admin/MarkdownEditor/MarkdownEditor.jsx';

import widgetStyles from '../../Widgets/AdminBookingWidget/AdminBookingWidget.module.css';
import styles from './AdminCustomerDetails.module.css';

const AdminCustomerDetails = ({
  customer,
  onCustomerChange,
  customerNotes,
  onCustomerNotesChange,
  adminNotes,
  onAdminNotesChange,
  paymentOption,
  onPaymentOptionChange,
  onSubmit,
  totalAmount,
  isLoading
}) => {

  const handlePaymentChange = (e) => {
    onPaymentOptionChange(e.target.value);
  };

  // Determine the final amount to display on the button.
  // If FOC is selected, the price is always 0.
  //
  const displayAmount = paymentOption === 'payment_foc' ? 0.00 : totalAmount;
  // --- [END FIX] ---

  return (
    <div className={widgetStyles.stepContent}>
      <h4 className={widgetStyles.stepTitle}>Customer Details</h4>
      
      {/* --- Customer Form Grid (Copied from CustomerDetailsForm.jsx) --- */}
      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label>First Name</label>
          <input type="text" name="firstName" value={customer.firstName} onChange={onCustomerChange} className={widgetStyles.input} required />
        </div>
        <div className={styles.formGroup}>
          <label>Last Name</label>
          <input type="text" name="lastName" value={customer.lastName} onChange={onCustomerChange} className={widgetStyles.input} required />
        </div>
        <div className={styles.formGroup}>
          <label>Email</label>
          <input type="email" name="email" value={customer.email} onChange={onCustomerChange} className={widgetStyles.input} required />
        </div>
        <div className={styles.formGroup}>
          <label>Phone</label>
          <input type="tel" name="phone" value={customer.phone} onChange={onCustomerChange} className={widgetStyles.input} required />
        </div>
      </div>

      {/* --- Customer Notes (Copied from CustomerDetailsForm.jsx) --- */}
      <div className={styles.formGroup} style={{ marginTop: '1.5rem' }}>
        <label>Notes / Special Requests (Optional)</label>
        <MarkdownEditor
          value={customerNotes}
          onChange={onCustomerNotesChange} // Use direct prop
          disabled={isLoading}
        />
      </div>

      {/* --- [ADMIN] Payment Option (Retained from my previous version) --- */}
      <div className={styles.formGroup} style={{ marginTop: '1.5rem' }}>
        <label>Payment Option</label>
        <div className={styles.radioGroup}>
          <label>
            <input 
              type="radio" 
              name="paymentOption" 
              value="payment_manual_pending"
              checked={paymentOption === 'payment_manual_pending'}
              onChange={handlePaymentChange}
            />
            Expect Payment on Arrival (Status: 'payment_manual_pending')
          </label>
          <label>
            <input 
              type="radio" 
              name="paymentOption" 
              value="payment_foc"
              checked={paymentOption === 'payment_foc'}
              onChange={handlePaymentChange}
            />
            Free of Charge (Comp) (Status: 'payment_foc')
          </label>
        </div>
      </div>

      {/* --- [ADMIN] FOC Reason (Modified to use MarkdownEditor) --- */}
      {paymentOption === 'payment_foc' && (
        <div className={styles.formGroup} style={{ marginTop: '1.5rem' }}>
          <label htmlFor="adminNotes">Reason for FOC (Required)</label>
          <MarkdownEditor
            value={adminNotes}
            onChange={onAdminNotesChange} // Use direct prop
            disabled={isLoading}
            placeholder="e.g., Influencer comp, staff..."
          />
        </div>
      )}

      {/* --- Submit Button (Copied from CustomerDetailsForm.jsx) --- */}
      <button 
        className={widgetStyles.bookButton} 
        onClick={onSubmit}
        disabled={isLoading}
      >
        {/* --- [FIX] Use the conditional displayAmount --- */}
        {isLoading ? 'Processing...' : `Create Confirmed Booking ($${displayAmount.toFixed(2)})`}
      </button>
    </div>
  );
};

export default AdminCustomerDetails;