// ==========================================
// client/src/adminPortal/MADTourManagement/BookingManager/BookingManager.jsx
// ==========================================

import React, { useState, useEffect, useCallback } from 'react';
import { 
  getAllBookings, 
  refundBooking,  // This is for Stripe refunds
  adminCancelBooking, // This is for unpaid cancellations
  manualMarkAsPaid,
  manualMarkRefunded,
  retryStripeRefund
} from '../../../services/admin/adminBookingService.js';
import ConfirmationDialog from '../../../MADLibrary/admin/dialogbox/ConfirmationDialog.jsx';
import BookingActionModal from './BookingActionModal.jsx';
import useDebounce from '../../../utils/useDebounce.js';
import styles from './BookingManager.module.css';
import sharedStyles from '../../../MADLibrary/admin/styles/adminshared.module.css';


// --- [REFACTORED] Quick filters ---
const quickFilters = [
  { 
    id: 'action_required', 
    label: 'Action Required',
    badge: 0 // Will be populated by fetchQueueCounts
  },
  { 
    id: 'pay_on_arrival', 
    label: 'Pay on Arrival',
    badge: 0 // Will be populated by fetchQueueCounts
  },
  { id: 'seat_confirmed', label: 'Confirmed', badge: 0 },
  { id: 'all', label: 'All Bookings', badge: 0 },
  { id: 'seat_cancelled', label: 'Cancelled', badge: 0 },
];

const BookingManager = ({ defaultActionCount }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // --- [NEW] State to hold counts for sub-tab badges ---
  const [queueCounts, setQueueCounts] = useState({
    action_required: 0,
    pay_on_arrival: 0,
  });

  const [activeQuickFilter, setActiveQuickFilter] = useState(
    // --- [FIX] Default to the new 'action_required' tab if there's an action ---
    defaultActionCount > 0 ? 'action_required' : 'seat_confirmed'
  );
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilters, setDateFilters] = useState({
    startDate: '',
    endDate: ''
  });
  
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  
  const [modalBooking, setModalBooking] = useState(null);

  // --- Dialog states ---
  const [resolveStripeDialog, setResolveStripeDialog] = useState({ booking: null });
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  
  const [resolveManualRefundDialog, setResolveManualRefundDialog] = useState({ booking: null });
  const [manualRefundReason, setManualRefundReason] = useState('');

  const [resolveRetryStripeDialog, setResolveRetryStripeDialog] = useState({ booking: null });
  
  const [transferDialog, setTransferDialog] = useState({ booking: null });
  
  const [resolveUnpaidCancelDialog, setResolveUnpaidCancelDialog] = useState({ booking: null });
  const [cancelReason, setCancelReason] = useState('');
  
  const [payDialog, setPayDialog] = useState({ booking: null });


  // --- [NEW] Function to fetch all queue counts for sub-tab badges ---
  const fetchQueueCounts = useCallback(async () => {
    try {
      // Run all count queries in parallel
      const [actionData, payOnArrivalData] = await Promise.all([
        getAllBookings({ special_filter: 'action_required' }),
        getAllBookings({ special_filter: 'pay_on_arrival_queue' })
      ]);
      
      setQueueCounts({
        action_required: actionData.length || 0,
        pay_on_arrival: payOnArrivalData.length || 0,
      });
      
    } catch (error) {
      console.error('Error fetching queue counts:', error);
    }
  }, []); // Empty dependency array, this is stable

  /**
   * --- [REFACTORED] Main data loading function ---
   * Now queries using the correct filter for the active tab.
   */
  const loadBookings = useCallback(async () => {
    setLoading(true);
    setToast(null);
    
    let filters = {
      startDate: dateFilters.startDate,
      endDate: dateFilters.endDate,
      searchTerm: debouncedSearchTerm,
    };

    // --- [FIX] Logic for new tabs ---
    if (activeQuickFilter === 'action_required') {
      filters.special_filter = 'action_required';
    } else if (activeQuickFilter === 'pay_on_arrival') {
      filters.special_filter = 'pay_on_arrival_queue';
    } else if (activeQuickFilter !== 'all') {
      filters.seat_status = activeQuickFilter;
    }

    try {
      const data = await getAllBookings(filters);
      setBookings(data);
    } catch (error) {
      console.error('Error loading bookings:', error);
      setToast({ type: 'error', message: `Failed to load bookings: ${error.message}` });
    } finally {
      setLoading(false);
    }
  }, [activeQuickFilter, dateFilters, debouncedSearchTerm]); 

  // --- [REFACTORED] Main useEffect ---
  useEffect(() => {
    // Load counts for the badges first
    fetchQueueCounts();
    // Then load the bookings for the active tab
    loadBookings();
  }, [loadBookings, fetchQueueCounts]); // Both are stable callbacks

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleCloseDialogs = () => {
    setModalBooking(null); 
    setResolveStripeDialog({ booking: null });
    setResolveManualRefundDialog({ booking: null });
    setResolveRetryStripeDialog({ booking: null });
    setTransferDialog({ booking: null });
    setResolveUnpaidCancelDialog({ booking: null });
    setPayDialog({ booking: null }); 
    setCancelReason('');
    setRefundReason('');
    setManualRefundReason('');
  };

  const handleActionClick = (actionType, booking) => {
    setModalBooking(null); 
    
    setTimeout(() => {
      switch (actionType) {
        // --- Triage Actions ---
        case 'resolve_stripe_refund':
          setResolveStripeDialog({ booking: booking });
          setRefundAmount(booking.total_amount);
          setRefundReason('');
          break;
        case 'resolve_manual_refund':
          setResolveManualRefundDialog({ booking: booking });
          setManualRefundReason('');
          break;
        case 'resolve_cancel_unpaid':
          setResolveUnpaidCancelDialog({ booking: booking });
          setCancelReason('');
          break;
        case 'resolve_retry_stripe':
          setResolveRetryStripeDialog({ booking: booking });
          break;
        case 'transfer':
          setTransferDialog({ booking: booking });
          break;

        // --- Standard Actions ---
        case 'mark_as_paid':
          setPayDialog({ booking: booking }); 
          break;
        case 'standard_cancel':
          setResolveUnpaidCancelDialog({ booking: booking });
          setCancelReason('');
          break;
        case 'standard_refund':
          setResolveStripeDialog({ booking: booking });
          setRefundAmount(booking.total_amount);
          setRefundReason('');
          break;
        default:
          console.error('Unknown action type:', actionType);
      }
    }, 50);
  };
  
  // --- [NEW] This function now also re-fetches counts ---
  const handleQuickFilterChange = (newFilterId) => {
    setActiveQuickFilter(newFilterId);
    setSearchTerm('');
    setDateFilters({ startDate: '', endDate: '' });
    fetchQueueCounts(); // Re-fetch counts on tab change
  };
  
  const handleClearFilters = () => {
    setSearchTerm('');
    setDateFilters({ startDate: '', endDate: '' });
  };
  
  // --- [NEW] Helper to reload all data after an action ---
  const reloadAllData = () => {
    fetchQueueCounts();
    loadBookings();
  };

  // --- Confirmation Handlers (REFACTORED) ---
  // All handlers now call reloadAllData() on success.
  
  const handleConfirmStripeRefund = async () => {
    const { booking } = resolveStripeDialog;
    if (!refundReason) {
      alert('Refund reason is required.');
      return;
    }
    try {
      const amount = (refundAmount === '' || parseFloat(refundAmount) === parseFloat(booking.total_amount)) ? null : parseFloat(refundAmount);
      await refundBooking(booking.id, amount, refundReason);
      setToast({ type: 'success', message: `Booking ${booking.booking_reference} refund is processing.` });
      handleCloseDialogs();
      reloadAllData(); // --- [FIX] ---
    } catch (error) {
      console.error('Error processing Stripe refund:', error);
      setToast({ type: 'error', message: `Refund failed: ${error.message}` });
    }
  };
  
  const handleConfirmTransfer = () => {
    setToast({ type: 'info', message: 'Transfer feature is not yet implemented. No action taken.'});
    handleCloseDialogs();
  };
  
  const handleConfirmManualRefund = async () => {
    const { booking } = resolveManualRefundDialog;
    if (!manualRefundReason) {
      alert('Reason is required.');
      return;
    }
    try {
      await manualMarkRefunded(booking.id, manualRefundReason);
      setToast({ type: 'success', message: `Booking ${booking.booking_reference} marked as manually refunded.` });
      handleCloseDialogs();
      reloadAllData(); // --- [FIX] ---
    } catch (error) {
      console.error('Error marking manual refund:', error);
      setToast({ type: 'error', message: `Failed: ${error.message}` });
    }
  };

  const handleConfirmRetryStripe = async () => {
    const { booking } = resolveRetryStripeDialog;
     try {
      await retryStripeRefund(booking.id);
      setToast({ type: 'success', message: `Retrying refund for ${booking.booking_reference}.` });
      handleCloseDialogs();
      reloadAllData(); // --- [FIX] ---
    } catch (error) {
      console.error('Error retrying refund:', error);
      setToast({ type: 'error', message: `Failed: ${error.message}` });
    }
  };
  
  const handleConfirmUnpaidCancel = async () => {
    const { booking } = resolveUnpaidCancelDialog;
    if (!cancelReason) {
      alert('Reason is required to cancel this booking.');
      return;
    }
    try {
      await adminCancelBooking(booking.id, cancelReason);
      setToast({ type: 'success', message: `Booking ${booking.booking_reference} has been cancelled.` });
      handleCloseDialogs();
      reloadAllData(); // --- [FIX] ---
    } catch (error) {
      console.error('Error manually cancelling booking:', error);
      setToast({ type: 'error', message: `Cancellation failed: ${error.message}` });
    }
  };
  
  const handleConfirmMarkAsPaid = async () => {
    const { booking } = payDialog;
    try {
      await manualMarkAsPaid(booking.id, 'Manual admin payment received');
      setToast({ type: 'success', message: `Booking ${booking.booking_reference} marked as paid.` });
      handleCloseDialogs();
      reloadAllData(); // --- [FIX] ---
    } catch (error) {
      console.error('Error marking booking as paid:', error);
      setToast({ type: 'error', message: `Payment update failed: ${error.message}` });
    }
  };

  // --- [NEW] Dynamically define quick filters with badges ---
  const populatedQuickFilters = [
    { 
      id: 'action_required', 
      label: 'Action Required',
      badge: queueCounts.action_required,
      badgeType: 'destructive' // Use red badge
    },
    { 
      id: 'pay_on_arrival', 
      label: 'Pay on Arrival',
      badge: queueCounts.pay_on_arrival,
      badgeType: 'informational' // Use grey badge
    },
    { id: 'seat_confirmed', label: 'Confirmed', badge: 0, badgeType: 'informational' },
    { id: 'all', label: 'All Bookings', badge: 0, badgeType: 'informational' },
    { id: 'seat_cancelled', label: 'Cancelled', badge: 0, badgeType: 'informational' },
  ];
  
  const isActionView = activeQuickFilter === 'action_required';

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

      {/* --- Desktop Quick Filter Nav (REFACTORED) --- */}
      <div className={`${styles.quickFilterNav} ${styles.desktopNav}`}>
        {populatedQuickFilters.map(filter => (
          <button
            key={filter.id}
            className={`${styles.navButton} ${activeQuickFilter === filter.id ? styles.active : ''}`}
            onClick={() => handleQuickFilterChange(filter.id)}
          >
            <span>{filter.label}</span>
            {/* --- [FIX] Conditional badge styling --- */}
            {filter.badge > 0 && (
              <span className={
                filter.badgeType === 'destructive'
                  ? styles.badgeDestructive
                  : styles.badgeInformational
              }>
                {filter.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      
      {/* --- Mobile Quick Filter Select (REFACTORED) --- */}
      <div className={styles.mobileNav}>
        <select
          className={styles.mobileQuickFilter}
          value={activeQuickFilter}
          onChange={(e) => handleQuickFilterChange(e.target.value)}
        >
          {populatedQuickFilters.map(filter => (
            <option key={filter.id} value={filter.id}>
              {filter.label} {filter.badge > 0 ? `(${filter.badge})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* --- Collapsible Filter Box --- */}
      <div className={sharedStyles.filterBox} style={{ marginBottom: '1.5rem', gap: '0' }}>
        
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
        
        <div className={`${styles.collapsibleSearch} ${isSearchOpen ? styles.open : ''}`}>
          <div className={styles.searchActionRow}>
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
            <div className={styles.filterPanelActions}>
              <button 
                className={sharedStyles.secondaryButton}
                onClick={handleClearFilters}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
      
      
      {/* --- Responsive Content Area (REFACTORED) --- */}
      <div className={sharedStyles.contentBox}>
        
        <table className={`${sharedStyles.table} ${styles.desktopTable}`}>
          <thead>
            <tr>
              <th className={styles.textLeft}>Customer</th>
              {/* --- [TYPO FIX] --- */}
              <th className={styles.textLeft}>Tour Details</th>
              <th className={styles.textCenter}>Seats</th>
              <th className={styles.textCenter}>Amount</th>
              <th className={styles.textCenter}>Booking</th>
              <th className={styles.textCenter}>Payment</th>
              {isActionView && <th className={styles.textCenter}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isActionView ? 7 : 6}>
                  <div className={sharedStyles.loadingContainer}>
                    <div className={sharedStyles.spinner}></div>
                  </div>
                </td>
              </tr>
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={isActionView ? 7 : 6} style={{ textAlign: 'center', padding: '2rem' }}>
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
                    <span className={`${styles.badge} ${styles[booking.seat_status]}`}>
                      {booking.seat_status}
                    </span>
                  </td>
                  <td className={styles.textCenter}>
                    <span className={`${styles.badge} ${styles[booking.payment_status]}`}>
                      {booking.payment_status}
                    </span>
                  </td>
                  
                  {isActionView && (
                    <td className={`${styles.reason} ${styles.textCenter}`}>
                      {/* --- [NEW] Show the admin what to do --- */}
                      {booking.seat_status === 'triage' && "Triage"}
                      {booking.payment_status === 'refund_stripe_failed' && "Refund Failed"}
                      {booking.seat_status === 'seat_pending' && "Stuck Hostage"}
                      {booking.payment_status === 'payment_manual_pending' && "Missed Payment"}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {/* --- Mobile Card List (REFACTORED) --- */}
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
                    <span className={`${styles.badge} ${styles[booking.seat_status]}`}>
                      {booking.seat_status}
                    </span>
                  </div>
                  <div className={styles.cardStatusItem}>
                    <label>Payment</label>
                    <span className={`${styles.badge} ${styles[booking.payment_status]}`}>
                      {booking.payment_status}
                    </span>
                  </div>
                </div>

                {isActionView && (
                  <div className={styles.cardReason}>
                    <strong>Action:</strong> 
                    {booking.seat_status === 'triage' && " Triage"}
                    {booking.payment_status === 'refund_stripe_failed' && " Refund Failed"}
                    {booking.seat_status === 'seat_pending' && " Stuck Hostage"}
                    {booking.payment_status === 'payment_manual_pending' && " Missed Payment"}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- Render the Action Modal (REFACTORED) --- */}
      {modalBooking && (
        <BookingActionModal
          booking={modalBooking}
          onClose={() => setModalBooking(null)}
          onTriggerAction={handleActionClick}
          // --- [FIX] Pass the correct view flag ---
          isActionView={isActionView} 
        />
      )}

      {/* --- ALL CONFIRMATION DIALOGS (REFACTORED & NEW) --- */}
      
      <ConfirmationDialog
        isOpen={!!resolveStripeDialog.booking}
        title="Process Stripe Refund"
        message={
          isActionView 
            ? `Resolve this item by processing a Stripe refund for ${resolveStripeDialog.booking?.booking_reference}? This will move the booking to 'Cancelled' and set payment to 'refund_stripe_pending'.`
            : `Process a Stripe refund for ${resolveStripeDialog.booking?.booking_reference}? This will cancel the booking.`
        }
        onConfirm={handleConfirmStripeRefund}
        onClose={handleCloseDialogs}
        confirmText="Process Stripe Refund"
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
              max={resolveStripeDialog.booking?.total_amount}
              placeholder="Leave blank for full refund"
            />
            <small>Original amount: ${resolveStripeDialog.booking?.total_amount}</small>
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
        isOpen={!!resolveManualRefundDialog.booking}
        title="Mark Manual Refund"
        message={`Resolve this item by confirming you have manually refunded ${resolveManualRefundDialog.booking?.booking_reference} (e.g., cash, bank transfer). This will move the booking to 'Cancelled' and 'refund_manual_success'.`}
        onConfirm={handleConfirmManualRefund}
        onClose={handleCloseDialogs}
        confirmText="Confirm Manual Refund"
        cancelText="Cancel"
        isDestructive={true}
      >
         <div className={styles.refundForm}>
          <div className={sharedStyles.formGroup}>
            <label htmlFor="manual-refund-reason">Reason (required):</label>
            <textarea
              id="manual-refund-reason"
              className={sharedStyles.textarea}
              value={manualRefundReason}
              onChange={(e) => setManualRefundReason(e.target.value)}
              placeholder="Reason for refund (e.g., 'Cash refund processed')."
              rows="3"
              required
            />
          </div>
        </div>
      </ConfirmationDialog>
      
      <ConfirmationDialog
        isOpen={!!resolveRetryStripeDialog.booking}
        title="Retry Stripe Refund"
        message={`The last refund attempt for ${resolveRetryStripeDialog.booking?.booking_reference} failed. Do you want to try processing the Stripe refund again?`}
        onConfirm={handleConfirmRetryStripe}
        onClose={handleCloseDialogs}
        confirmText="Retry Stripe Refund"
        cancelText="Cancel"
        isDestructive={false}
      />
      
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
        isOpen={!!resolveUnpaidCancelDialog.booking}
        title="Manually Cancel Booking"
        message={`Are you sure you want to cancel booking ${resolveUnpaidCancelDialog.booking?.booking_reference}? This will release its ${resolveUnpaidCancelDialog.booking?.seats} seats back into inventory.`}
        onConfirm={handleConfirmUnpaidCancel}
        onClose={handleCloseDialogs}
        confirmText="Cancel Booking"
        cancelText="Back"
        isDestructive={true}
      >
        <div className={styles.refundForm}>
          <div className={sharedStyles.formGroup}>
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

      <ConfirmationDialog
        isOpen={!!payDialog.booking}
        title="Manually Mark as Paid"
        message={`Are you sure you want to mark booking ${payDialog.booking?.booking_reference} as 'payment_manual_success'? This should only be done after receiving payment (e.g., cash).`}
        onConfirm={handleConfirmMarkAsPaid}
        onClose={handleCloseDialogs}
        confirmText="Mark as Paid"
        cancelText="Cancel"
        isDestructive={false}
      />
      
    </div>
  );
};

export default BookingManager;