// client/src/adminPortal/MADTourManagement/BookingManager/BookingManager.jsx
import React, { useState, useEffect } from 'react';
import { getAllBookings, refundBooking, cancelBooking } from '../../../services/admin/adminBookingService.js';
import ConfirmationDialog from '../../../ui/dialogbox/ConfirmationDialog.jsx';
import styles from './BookingManager.module.css';
import sharedStyles from '../../adminshared.module.css';

// --- NEW: Define our "quick filter" views ---
const quickFilters = [
  { id: 'pending_triage', label: 'Pending Resolution' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'pending', label: 'Pending Payment' },
  { id: 'all', label: 'All Bookings' },
  { id: 'cancelled', label: 'Cancelled' },
];

const BookingManager = ({ defaultResolutionCount }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // --- NEW: State for active quick filter ---
  const [activeQuickFilter, setActiveQuickFilter] = useState(
    defaultResolutionCount > 0 ? 'pending_triage' : 'confirmed'
  );
  
  // --- State for date filters (now used for 'all' view) ---
  const [dateFilters, setDateFilters] = useState({
    startDate: '',
    endDate: ''
  });
  
  // --- Dialog states ---
  const [refundDialog, setRefundDialog] = useState({ booking: null });
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  
  // --- STUB: Transfer Dialog ---
  const [transferDialog, setTransferDialog] = useState({ booking: null });

  useEffect(() => {
    loadBookings();
  }, [activeQuickFilter, dateFilters]); // Reload on quick filter or date change

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadBookings = async () => {
    setLoading(true);
    setToast(null);
    try {
      let filters = {
        status: activeQuickFilter === 'all' ? '' : activeQuickFilter,
        ...dateFilters
      };
      
      // If view isn't 'all', ignore date ranges for clarity
      if (activeQuickFilter !== 'all') {
        filters.startDate = '';
        filters.endDate = '';
      }

      const data = await getAllBookings(filters);
      setBookings(data);
    } catch (error) {
      console.error('Error loading bookings:', error);
      setToast({ type: 'error', message: `Failed to load bookings: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  // --- REFUND ACTION ---
  const handleRefundClick = (booking) => {
    setRefundDialog({ booking: booking });
    setRefundAmount(booking.total_amount); // Default to full refund
    setRefundReason('');
  };

  const handleCloseDialogs = () => {
    setRefundDialog({ booking: null });
    setTransferDialog({ booking: null });
  };

  const handleConfirmRefund = async () => {
    const { booking } = refundDialog;
    if (!refundReason) {
      alert('Refund reason is required.');
      return;
    }
    
    try {
      const amount = (refundAmount === '' || parseFloat(refundAmount) === parseFloat(booking.total_amount))
        ? null 
        : parseFloat(refundAmount);
        
      await refundBooking(booking.id, amount, refundReason);
      await cancelBooking(booking.id, `Resolution Refund: ${refundReason}`);

      setToast({ type: 'success', message: `Booking ${booking.booking_reference} has been refunded and cancelled.` });
      handleCloseDialogs();
      loadBookings(); // Refresh the list
    } catch (error) {
      console.error('Error processing refund:', error);
      setToast({ type: 'error', message: `Refund failed: ${error.message}` });
    }
  };
  
  // --- TRANSFER ACTION (STUB) ---
  const handleTransferClick = (booking) => {
    setTransferDialog({ booking: booking });
  };

  const handleConfirmTransfer = () => {
    setToast({ 
      type: 'info', 
      message: 'Transfer feature is not yet implemented. No action taken.'
    });
    handleCloseDialogs();
  };
  
  // --- NEW: Helper to determine which columns to show ---
  const isResolutionView = activeQuickFilter === 'pending_triage';

  return (
    <div className={styles.bookingManager}>
      {toast && (
        <div 
          className={sharedStyles.toastNotification}
          style={{ 
            borderLeftColor: toast.type === 'error' ? 'var(--destructive)' : (toast.type === 'info' ? 'var(--grey-700)' : 'var(--text)'),
            backgroundColor: toast.type === 'info' ? 'var(--grey-100)' : 'var(--background)'
          }}
        >
          <p>{toast.message}</p>
          <button onClick={() => setToast(null)}>Close</button>
        </div>
      )}

      {/* --- NEW: Quick Filter Navigation --- */}
      <div className={styles.quickFilterNav}>
        {quickFilters.map(filter => (
          <button
            key={filter.id}
            className={`${styles.navButton} ${activeQuickFilter === filter.id ? styles.active : ''}`}
            onClick={() => setActiveQuickFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* --- Conditional Date Filters (only for 'all' view) --- */}
      {activeQuickFilter === 'all' && (
        <div className={sharedStyles.filterBox}>
          <div className={sharedStyles.filterGroup}>
            <label htmlFor="filter-start-date">From Date:</label>
            <input
              id="filter-start-date"
              type="date"
              className={sharedStyles.input}
              value={dateFilters.startDate}
              onChange={(e) => setDateFilters({ ...dateFilters, startDate: e.target.value })}
            />
          </div>
          <div className={sharedStyles.filterGroup}>
            <label htmlFor="filter-end-date">To Date:</label>
            <input
              id="filter-end-date"
              type="date"
              className={sharedStyles.input}
              value={dateFilters.endDate}
              onChange={(e) => setDateFilters({ ...dateFilters, endDate: e.target.value })}
            />
          </div>
        </div>
      )}
      
      {/* --- Content Area --- */}
      <div className={sharedStyles.contentBox}>
        <table className={sharedStyles.table}>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Customer</th>
              <th>Tour</th>
              <th>Date/Time</th>
              <th>Seats</th>
              <th>Amount</th>
              {/* --- DYNAMIC COLUMNS --- */}
              {isResolutionView ? (
                <>
                  <th>Reason</th>
                  <th>Actions</th>
                </>
              ) : (
                <>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className={sharedStyles.loadingContainer}>
                    <div className={sharedStyles.spinner}></div>
                  </div>
                </td>
              </tr>
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>
                  No bookings found for this view.
                </td>
              </tr>
            ) : (
              bookings.map(booking => (
                <tr key={booking.id}>
                  <td className={styles.reference}>{booking.booking_reference}</td>
                  <td>
                    <div>{booking.first_name} {booking.last_name}</div>
                    <div className={styles.email}>{booking.email}</div>
                  </td>
                  <td>{booking.tour_name}</td>
                  <td>
                    <div>{new Date(booking.date).toLocaleDateString()}</div>
                    <div className={styles.time}>{booking.time.substring(0, 5)}</div>
                  </td>
                  <td className={styles.centered}>{booking.seats}</td>
                  <td className={styles.amount}>${booking.total_amount}</td>
                  
                  {/* --- DYNAMIC CONTENT --- */}
                  {isResolutionView ? (
                    <>
                      {/* --- PENDING RESOLUTION VIEW --- */}
                      <td className={styles.reason}>
                        {/* We need to fetch this from the instance... */}
                        {'N/A'}
                      </td>
                      <td className={styles.actions}>
                        <button
                          onClick={() => handleRefundClick(booking)}
                          className={sharedStyles.destructiveButtonSmall}
                        >
                          Refund
                        </button>
                        <button
                          onClick={() => handleTransferClick(booking)}
                          className={sharedStyles.primaryButtonSmall}
                          style={{ marginLeft: '0.5rem' }}
                        >
                          Transfer
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      {/* --- ALL OTHER VIEWS --- */}
                      <td>
                        <span className={`${styles.badge} ${styles[booking.status]}`}>
                          {booking.status}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${styles[booking.payment_status]}`}>
                          {booking.payment_status}
                        </span>
                      </td>
                      <td className={styles.actions}>
                        {booking.status === 'confirmed' && booking.payment_status === 'paid' && (
                          <button
                            onClick={() => handleRefundClick(booking)}
                            className={sharedStyles.destructiveGhostButtonSmall}
                          >
                            Refund
                          </button>
                        )}
                        {/* Other actions like 'Resend Email' could go here */}
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- MODALS (Unchanged from previous plan) --- */}
      
      <ConfirmationDialog
        isOpen={!!refundDialog.booking}
        title="Process Refund"
        message={
          isResolutionView 
            ? `Resolve this item by processing a refund for ${refundDialog.booking?.booking_reference}? This will move the booking to 'Cancelled'.`
            : `Process refund for booking ${refundDialog.booking?.booking_reference}? This will also cancel the booking if it's not already.`
        }
        onConfirm={handleConfirmRefund}
        onClose={handleCloseDialogs}
        confirmText="Process Refund"
        cancelText="Cancel"
        isDestructive={true}
      >
        <div className={styles.refundForm}>
          <div className={sharedStyles.formGroup}>
            <label htmlFor="refund-amount">Refund Amount:</label>
            <input
              id="refund-amount"
              type="number"
              step="0.01"
              className={sharedStyles.input}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              max={refundDialog.booking?.total_amount}
              placeholder="Leave blank for full refund"
            />
            <small>Original amount: ${refundDialog.booking?.total_amount}</small>
          </div>
          <div className={sharedStyles.formGroup}>
            <label htmlFor="refund-reason">Reason (required):</label>
            <textarea
              id="refund-reason"
              className={sharedStyles.textarea}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Reason for refund..."
              rows="3"
              required
            />
          </div>
        </div>
      </ConfirmationDialog>
      
      <ConfirmationDialog
        isOpen={!!transferDialog.booking}
        title="Transfer Booking (STUB)"
        message={`This feature is not yet implemented. \n\nIn a future task, this dialog will allow you to select a new, available tour instance for ${transferDialog.booking?.booking_reference} and re-confirm the booking.`}
        onConfirm={handleConfirmTransfer}
        onClose={handleCloseDialogs}
        confirmText="Acknowledge"
        cancelText="Close"
        isDestructive={false}
      />
    </div>
  );
};

export default BookingManager;