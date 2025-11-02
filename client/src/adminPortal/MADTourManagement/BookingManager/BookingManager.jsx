// ==========================================
// ADMIN: Booking Manager with Refund UI
// client/src/adminPortal/MADTourManagement/BookingManager/BookingManager.jsx
// ==========================================

import React, { useState, useEffect } from 'react';
import { getAllBookings, refundBooking, cancelBooking } from '../../../services/admin/adminBookingService.js';
import ConfirmationDialog from '../../../ui/dialogbox/ConfirmationDialog.jsx';
import styles from './BookingManager.module.css';
import sharedStyles from '../../adminshared.module.css'; // Import shared styles

const BookingManager = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'confirmed',
    startDate: '',
    endDate: ''
  });
  
  // --- REFACTORED STATE ---
  // We no longer store 'open'. The dialog is open if 'booking' is not null.
  const [refundDialog, setRefundDialog] = useState({ booking: null });
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  useEffect(() => {
    loadBookings();
  }, [filters]);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const data = await getAllBookings(filters);
      setBookings(data);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefundClick = (booking) => {
    setRefundDialog({ booking: booking });
    setRefundAmount(booking.total_amount); // Default to full refund
    setRefundReason('');
  };

  const handleCloseDialog = () => {
    setRefundDialog({ booking: null });
  };

  const handleConfirmRefund = async () => {
    if (!refundReason) {
      alert('Refund reason is required.');
      return;
    }
    
    try {
      // Use null for full refund, otherwise parse the amount
      const amount = (refundAmount === '' || parseFloat(refundAmount) === parseFloat(refundDialog.booking.total_amount))
        ? null 
        : parseFloat(refundAmount);
        
      await refundBooking(refundDialog.booking.id, amount, refundReason);
      
      // Cancel booking if not already cancelled
      if (refundDialog.booking.status !== 'cancelled') {
        await cancelBooking(refundDialog.booking.id, refundReason);
      }

      handleCloseDialog();
      loadBookings();
      alert('Refund processed successfully. Customer will be notified by email.');
    } catch (error) {
      console.error('Error processing refund:', error);
      alert('Failed to process refund: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className={sharedStyles.loadingContainer}>
        <div className={sharedStyles.spinner}></div>
        <span>Loading bookings...</span>
      </div>
    );
  }

  return (
    <div className={styles.bookingManager}>
      {/* <h1> HAS BEEN REMOVED - Handled by wrapper */}

      <div className={sharedStyles.filterBox}>
        <div className={sharedStyles.filterGroup}>
          <label htmlFor="filter-status">Status:</label>
          <select
            id="filter-status"
            className={sharedStyles.input}
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className={sharedStyles.filterGroup}>
          <label htmlFor="filter-start-date">From Date:</label>
          <input
            id="filter-start-date"
            type="date"
            className={sharedStyles.input}
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          />
        </div>
        <div className={sharedStyles.filterGroup}>
          <label htmlFor="filter-end-date">To Date:</label>
          <input
            id="filter-end-date"
            type="date"
            className={sharedStyles.input}
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          />
        </div>
      </div>

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
              <th>Status</th>
              <th>Payment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>
                  No bookings found for these filters.
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
                    <div className={styles.time}>{booking.time}</div>
                  </td>
                  <td className={styles.centered}>{booking.seats}</td>
                  <td className={styles.amount}>${booking.total_amount}</td>
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- REFACTORED DIALOG ---
        The component is now rendered permanently and controls its
        own visibility via the 'isOpen' prop.
      */}
      <ConfirmationDialog
        isOpen={!!refundDialog.booking}
        title="Process Refund"
        message={`Process refund for booking ${refundDialog.booking?.booking_reference}?\nThis will also cancel the booking.`}
        onConfirm={handleConfirmRefund}
        onClose={handleCloseDialog}
        confirmText="Process Refund"
        cancelText="Cancel"
        isDestructive={true}
      >
        {/* Children prop is used for the form inside the dialog */}
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
    </div>
  );
};

export default BookingManager;