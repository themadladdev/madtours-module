// ==========================================
// UPDATED FILE
// client/src/adminPortal/MADTourManagement/BookingManager/BookingManager.jsx
// ==========================================

import React, { useState, useEffect, useCallback } from 'react';
import { 
  getAllBookings, 
  refundBooking, 
  cancelBooking, 
  manualConfirmBooking, 
  manualMarkAsPaid, 
  adminCancelBooking 
} from '../../../services/admin/adminBookingService.js';
import ConfirmationDialog from '../../../ui/dialogbox/ConfirmationDialog.jsx';
import BookingActionModal from './BookingActionModal.jsx';
import useDebounce from '../../../utils/useDebounce.js';
import styles from './BookingManager.module.css';
import sharedStyles from '../../adminshared.module.css';

// --- Define "quick filter" views ---
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

  const [activeQuickFilter, setActiveQuickFilter] = useState(
    defaultResolutionCount > 0 ? 'pending_triage' : 'confirmed'
  );
  
  // --- [MODIFIED] Search/Filter State ---
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilters, setDateFilters] = useState({
    startDate: '',
    endDate: ''
  });
  
  // --- [NEW] Create a debounced value for the search term ---
  // We wait 400ms after the user stops typing before searching
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  
  const [modalBooking, setModalBooking] = useState(null);

  // --- Dialog states ---
  const [refundDialog, setRefundDialog] = useState({ booking: null });
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  
  const [transferDialog, setTransferDialog] = useState({ booking: null });
  const [confirmDialog, setConfirmDialog] = useState({ booking: null });
  const [payDialog, setPayDialog] = useState({ booking: null });
  const [cancelDialog, setCancelDialog] = useState({ booking: null });
  const [cancelReason, setCancelReason] = useState('');

  // --- [REFACTORED] Main data loading function ---
  // Wrapped in useCallback to make it a stable dependency for useEffect.
  // It now takes NO arguments and simply reads the current, up-to-date state.
  const loadBookings = useCallback(async () => {
    setLoading(true);
    setToast(null);
    
    let filters = {
      status: activeQuickFilter === 'all' ? '' : activeQuickFilter,
      startDate: dateFilters.startDate,
      endDate: dateFilters.endDate,
      searchTerm: debouncedSearchTerm, // --- [MODIFIED] Use the debounced value
    };

    try {
      const data = await getAllBookings(filters);
      setBookings(data);
    } catch (error) {
      console.error('Error loading bookings:', error);
      setToast({ type: 'error', message: `Failed to load bookings: ${error.message}` });
    } finally {
      setLoading(false);
    }
  }, [activeQuickFilter, dateFilters, debouncedSearchTerm]); // Dependencies

  // --- [REFACTORED] Single useEffect for ALL data loading ---
  // This runs on mount and whenever any filter dependency changes.
  useEffect(() => {
    loadBookings();
  }, [loadBookings]); // The dependency is the stable loadBookings function

  // Unchanged: Effect for clearing toast notifications
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Unchanged: Close all dialogs
  const handleCloseDialogs = () => {
    setModalBooking(null); 
    setRefundDialog({ booking: null });
    setTransferDialog({ booking: null });
    setConfirmDialog({ booking: null });
    setPayDialog({ booking: null });
    setCancelDialog({ booking: null });
    setCancelReason('');
  };

  // Unchanged: Handle which action dialog to open
  const handleActionClick = (actionType, booking) => {
    setModalBooking(null); 
    
    setTimeout(() => {
      switch (actionType) {
        case 'confirm':
          setConfirmDialog({ booking: booking });
          break;
        case 'pay':
          setPayDialog({ booking: booking });
          break;
        case 'cancel':
          setCancelDialog({ booking: booking });
          setCancelReason('');
          break;
        case 'refund':
          setRefundDialog({ booking: booking });
          setRefundAmount(booking.total_amount);
          setRefundReason('');
          break;
        case 'transfer':
          setTransferDialog({ booking: booking });
          break;
        default:
          console.error('Unknown action type:', actionType);
      }
    }, 50);
  };
  
  // --- [NEW] Handler for Quick Filter Clicks ---
  // This sets the new filter AND clears the advanced filters,
  // which then triggers the main useEffect to reload the data.
  const handleQuickFilterChange = (newFilterId) => {
    setActiveQuickFilter(newFilterId);
    setSearchTerm('');
    setDateFilters({ startDate: '', endDate: '' });
  };
  
  // --- [REMOVED] handleSearchClick function is no longer needed ---

  // --- [REFACTORED] Clear Filters ---
  // This just resets the advanced filter state.
  // The main useEffect automatically detects this and reloads.
  const handleClearFilters = () => {
    setSearchTerm('');
    setDateFilters({ startDate: '', endDate: '' });
  };

  // --- All Confirmation Handlers (MODIFIED) ---
  // All calls to loadBookings(false) are replaced with loadBookings()
  
  const handleConfirmRefund = async () => {
    const { booking } = refundDialog;
    if (!refundReason) {
      alert('Refund reason is required.');
      return;
    }
    try {
      const amount = (refundAmount === '' || parseFloat(refundAmount) === parseFloat(booking.total_amount)) ? null : parseFloat(refundAmount);
      await refundBooking(booking.id, amount, refundReason);
      await cancelBooking(booking.id, `Resolution Refund: ${refundReason}`); 
      setToast({ type: 'success', message: `Booking ${booking.booking_reference} has been refunded and cancelled.` });
      handleCloseDialogs();
      loadBookings(); // --- [MODIFIED]
    } catch (error) {
      console.error('Error processing refund:', error);
      setToast({ type: 'error', message: `Refund failed: ${error.message}` });
    }
  };
  
  const handleConfirmTransfer = () => {
    setToast({ type: 'info', message: 'Transfer feature is not yet implemented. No action taken.'});
    handleCloseDialogs();
  };
  
  const handleConfirmManualBooking = async () => {
    const { booking } = confirmDialog;
    try {
      await manualConfirmBooking(booking.id);
      setToast({ type: 'success', message: `Booking ${booking.booking_reference} confirmed.` });
      handleCloseDialogs();
      loadBookings(); // --- [MODIFIED]
    } catch (error) {
      console.error('Error manually confirming booking:', error);
      setToast({ type: 'error', message: `Confirmation failed: ${error.message}` });
    }
  };
  
  const handleConfirmMarkAsPaid = async () => {
    const { booking } = payDialog;
    try {
      await manualMarkAsPaid(booking.id);
      setToast({ type: 'success', message: `Booking ${booking.booking_reference} marked as paid.` });
      handleCloseDialogs();
      loadBookings(); // --- [MODIFIED]
    } catch (error) {
      console.error('Error marking booking as paid:', error);
      setToast({ type: 'error', message: `Payment update failed: ${error.message}` });
    }
  };
  
  const handleConfirmCancel = async () => {
    const { booking } = cancelDialog;
    if (booking.status === 'pending' && !cancelReason) {
      alert('Reason is required to cancel a pending booking.');
      return;
    }
    try {
      await adminCancelBooking(booking.id, cancelReason || 'Admin cancellation');
      setToast({ type: 'success', message: `Booking ${booking.booking_reference} has been cancelled.` });
      handleCloseDialogs();
      loadBookings(); // --- [MODIFIED]
    } catch (error) {
      console.error('Error manually cancelling booking:', error);
      setToast({ type: 'error', message: `Cancellation failed: ${error.message}` });
    }
  };
  
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

      {/* --- Desktop Quick Filter Nav (MODIFIED) --- */}
      <div className={`${styles.quickFilterNav} ${styles.desktopNav}`}>
        {quickFilters.map(filter => (
          <button
            key={filter.id}
            className={`${styles.navButton} ${activeQuickFilter === filter.id ? styles.active : ''}`}
            onClick={() => handleQuickFilterChange(filter.id)} // --- [MODIFIED]
          >
            {filter.label}
          </button>
        ))}
      </div>
      
      {/* --- Mobile Quick Filter Select (MODIFIED) --- */}
      <div className={styles.mobileNav}>
        <select
          className={styles.mobileQuickFilter}
          value={activeQuickFilter}
          onChange={(e) => handleQuickFilterChange(e.target.value)} // --- [MODIFIED]
        >
          {quickFilters.map(filter => (
            <option key={filter.id} value={filter.id}>
              {filter.label}
            </option>
          ))}
        </select>
      </div>

      {/* --- Collapsible Filter Box --- */}
      <div className={sharedStyles.filterBox} style={{ marginBottom: '1.5rem', gap: '0' }}>
        
        {/* --- Row 1: Date Filters + Toggle Button --- */}
        <div className={styles.filterRow}>
          <div className={styles.filterItem}>
            <label htmlFor="filter-start-date">
              <span className={styles.desktopLabel}>Date </span>From:
            </label>
            <input
              id="filter-start-date"
              type="date"
              className={sharedStyles.input}
              value={dateFilters.startDate}
              onChange={(e) => setDateFilters({ ...dateFilters, startDate: e.target.value })}
              onClick={(e) => e.target.showPicker()}
              onMouseDown={(e) => e.preventDefault()}
            />
          </div>
          <div className={styles.filterItem}>
            <label htmlFor="filter-end-date">
              <span className={styles.desktopLabel}>Date </span>To:
            </label>
            <input
              id="filter-end-date"
              type="date"
              className={sharedStyles.input}
              value={dateFilters.endDate}
              onChange={(e) => setDateFilters({ ...dateFilters, endDate: e.target.value })}
              onClick={(e) => e.target.showPicker()}
              onMouseDown={(e) => e.preventDefault()}
            />
          </div>
          
          <div className={styles.toggleItem}>
            <button 
              className={styles.advancedSearchToggle} 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              title={isSearchOpen ? 'Hide Search' : 'Show Advanced Search'}
            >
              {isSearchOpen ? '▲' : '▼'}
            </button>
          </div>
        </div>
        
        {/* --- Row 2: Collapsible Search Area (MODIFIED) --- */}
        <div className={`${styles.collapsibleSearch} ${isSearchOpen ? styles.open : ''}`}>
          
          <div className={styles.searchActionRow}>
            
            {/* --- Search Input (Unchanged) --- */}
            <div className={styles.filterItem}>
              <label htmlFor="search-term">Search:</label>
              <input
                id="search-term"
                type="text"
                className={sharedStyles.input}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Name or Booking Ref..."
              />
            </div>

            {/* --- Action Buttons (MODIFIED) --- */}
            <div className={styles.filterPanelActions}>
              <button 
                className={sharedStyles.secondaryButton}
                onClick={handleClearFilters} // --- [MODIFIED]
              >
                Clear {/* --- [MODIFIED] Text changed */}
              </button>
              
              {/* --- [REMOVED] "Search" button is gone --- */}
            
            </div>
          </div>
        </div>
      </div>
      
      
      {/* --- Responsive Content Area (Unchanged) --- */}
      <div className={sharedStyles.contentBox}>
        
        <table className={`${sharedStyles.table} ${styles.desktopTable}`}>
          <thead>
            <tr>
              <th className={styles.textLeft}>Customer</th>
              <th className={styles.textLeft}>Tour Details</th>
              <th className={styles.textCenter}>Seats</th>
              <th className={styles.textCenter}>Amount</th>
              <th className={styles.textCenter}>Booking</th>
              <th className={styles.textCenter}>Payment</th>
              {isResolutionView && <th className={styles.textCenter}>Reason</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isResolutionView ? 7 : 6} style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className={sharedStyles.loadingContainer}>
                    <div className={sharedStyles.spinner}></div>
                  </div>
                </td>
              </tr>
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={isResolutionView ? 7 : 6} style={{ textAlign: 'center', padding: '2rem' }}>
                  No bookings found for this view.
                </td>
              </tr>
            ) : (
              bookings.map(booking => (
                <tr 
                  key={booking.id} 
                  className={styles.clickableRow}
                  onClick={() => setModalBooking(booking)}
                >
                  <td>
                    <div>{booking.first_name} {booking.last_name}</div>
                    <div className={styles.subText}>{booking.email}</div>
                  </td>
                  <td>
                    <div className={styles.reference}>{booking.booking_reference}</div>
                    <div>{booking.tour_name}</div>
                    <div className={styles.subText}>
                      {new Date(booking.date).toLocaleDateString()} @ {booking.time.substring(0, 5)}
                    </div>
                  </td>
                  <td className={styles.textCenter}>{booking.seats}</td>
                  <td className={`${styles.amount} ${styles.textCenter}`}>${booking.total_amount}</td>
                  
                  <td className={styles.textCenter}>
                    <span className={`${styles.badge} ${styles[booking.status]}`}>
                      {booking.status}
                    </span>
                  </td>
                  <td className={styles.textCenter}>
                    <span className={`${styles.badge} ${styles[booking.payment_status]}`}>
                      {booking.payment_status}
                    </span>
                  </td>
                  
                  {isResolutionView && (
                    <td className={`${styles.reason} ${styles.textCenter}`}>{'N/A'}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        <div className={styles.mobileCardList}>
          {loading ? (
            <div className={sharedStyles.loadingContainer}>
              <div className={sharedStyles.spinner}></div>
            </div>
          ) : bookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              No bookings found for this view.
            </div>
          ) : (
            bookings.map(booking => (
              <div 
                key={booking.id} 
                className={styles.bookingCard}
                onClick={() => setModalBooking(booking)}
              >
                
                <div className={styles.cardHeader}>
                  <span className={styles.cardRef}>{booking.booking_reference}</span>
                  <span className={styles.cardSeats}>{booking.seats} Seat(s)</span>
                </div>
                <div className={styles.cardName}>{booking.first_name} {booking.last_name}</div>
                
                <div className={styles.cardTour}>
                  {booking.tour_name} - {new Date(booking.date).toLocaleDateString()}
                </div>
                
                <div className={styles.cardStatusGrid}>
                  <div className={styles.cardStatusItem}>
                    <label>Booking</label>
                    <span className={`${styles.badge} ${styles[booking.status]}`}>
                      {booking.status}
                    </span>
                  </div>
                  <div className={styles.cardStatusItem}>
                    <label>Payment</label>
                    <span className={`${styles.badge} ${styles[booking.payment_status]}`}>
                      {booking.payment_status}
                    </span>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>
      </div>

      {/* --- Render the Action Modal (Unchanged) --- */}
      {modalBooking && (
        <BookingActionModal
          booking={modalBooking}
          onClose={() => setModalBooking(null)}
          onTriggerAction={handleActionClick}
          isResolutionView={isResolutionView}
        />
      )}

      {/* --- ALL CONFIRMATION DIALOGS (Unchanged) --- */}
      
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
              onChange={(e) => setRefundAmount(e.targe.value)}
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
        message={`This feature is not yet implemented. \n\In a future task, this will allow you to select a new, available tour instance for ${transferDialog.booking?.booking_reference} and re-confirm the booking.`}
        onConfirm={handleConfirmTransfer}
        onClose={handleCloseDialogs}
        confirmText="Acknowledge"
        cancelText="Close"
        isDestructive={false}
      />
      
      <ConfirmationDialog
        isOpen={!!confirmDialog.booking}
        title="Manually Confirm Booking"
        message={`Are you sure you want to manually confirm booking ${confirmDialog.booking?.booking_reference}? This will mark it as 'confirmed' and it will appear on the manifest. This does not affect payment status.`}
        onConfirm={handleConfirmManualBooking}
        onClose={handleCloseDialogs}
        confirmText="Confirm Booking"
        cancelText="Cancel"
        isDestructive={false}
      />
      
      <ConfirmationDialog
        isOpen={!!payDialog.booking}
        title="Manually Mark as Paid"
        message={`Are you sure you want to mark booking ${payDialog.booking?.booking_reference} as 'paid'? This should only be done after receiving payment (e.g., cash).`}
        onConfirm={handleConfirmMarkAsPaid}
        onClose={handleCloseDialogs}
        confirmText="Mark as Paid"
        cancelText="Cancel"
        isDestructive={false}
      />
      
      <ConfirmationDialog
        isOpen={!!cancelDialog.booking}
        title="Manually Cancel Booking"
        message={`Are you sure you want to cancel booking ${cancelDialog.booking?.booking_reference}? This will release its ${cancelDialog.booking?.seats} seats back into inventory.`}
        onConfirm={handleConfirmCancel}
        onClose={handleCloseDialogs}
        confirmText="Cancel Booking"
        cancelText="Back"
        isDestructive={true}
      >
        <div className={styles.refundForm}>
          <div className={styles.formGroup}>
            <label htmlFor="cancel-reason">Reason (required):</label>
            <textarea
              id="cancel-reason"
              className={sharedStyles.textarea}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation..."
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