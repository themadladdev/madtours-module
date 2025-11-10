// ==========================================
// client/src/adminPortal/MADTourManagement/BookingManager/BookingManager.jsx
// ==========================================

import React, { useState, useEffect, useCallback } from 'react';
import { 
  getAllBookings, 
  refundBooking,
  adminCancelBooking,
  manualMarkAsPaid,
  manualMarkRefunded,
  retryStripeRefund
} from '../../../services/admin/adminBookingService.js';

// --- Child component imports ---
import BookingFilter from './BookingFilter.jsx';
import BookingList from './BookingList.jsx';

import ConfirmationDialog from '../../../MADLibrary/admin/dialogbox/ConfirmationDialog.jsx';
import BookingActionModal from './BookingActionModal.jsx';
import useDebounce from '../../../utils/useDebounce.js';
import styles from './BookingManager.module.css';
import sharedStyles from '../../../MADLibrary/admin/styles/adminshared.module.css';

const BookingManager = ({ defaultActionCount }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [queueCounts, setQueueCounts] = useState({
    action_required: 0,
    pay_on_arrival: 0,
    pending_inventory: 0,
  });

  // This function now *only* runs on the very first load
  const getInitialFilter = () => {
    const presetFilter = sessionStorage.getItem('admin_preset_filter');
    if (presetFilter) {
      sessionStorage.removeItem('admin_preset_filter');
      return presetFilter;
    }
    return defaultActionCount > 0 ? 'action_required' : 'seat_confirmed';
  };

  const [activeQuickFilter, setActiveQuickFilter] = useState(getInitialFilter);
  
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

  // --- [NEW] This effect listens for dashboard navigation ---
  useEffect(() => {
    const checkPresetFilter = () => {
      const presetFilter = sessionStorage.getItem('admin_preset_filter');
      if (presetFilter) {
        sessionStorage.removeItem('admin_preset_filter');
        setActiveQuickFilter(presetFilter); // Set the active filter state
      }
    };
    
    // Listen for the same event the dashboard fires
    window.addEventListener('route-change', checkPresetFilter);
    
    return () => {
      window.removeEventListener('route-change', checkPresetFilter);
    };
  }, []); // Empty array ensures this runs once to set up the listener

  const fetchQueueCounts = useCallback(async () => {
    try {
      const [actionData, payOnArrivalData, pendingInvData] = await Promise.all([
        getAllBookings({ special_filter: 'action_required' }),
        getAllBookings({ special_filter: 'pay_on_arrival_queue' }),
        getAllBookings({ special_filter: 'pending_inventory' })
      ]);
      
      setQueueCounts({
        action_required: actionData.length || 0,
        pay_on_arrival: payOnArrivalData.length || 0,
        pending_inventory: pendingInvData.length || 0,
      });
      
    } catch (error) {
      console.error('Error fetching queue counts:', error);
    }
  }, []);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setToast(null);
    
    let filters = {
      startDate: dateFilters.startDate,
      endDate: dateFilters.endDate,
      searchTerm: debouncedSearchTerm,
    };

    if (activeQuickFilter === 'action_required') {
      filters.special_filter = 'action_required';
    } else if (activeQuickFilter === 'pay_on_arrival') {
      filters.special_filter = 'pay_on_arrival_queue';
    } else if (activeQuickFilter === 'pending_inventory') {
      filters.special_filter = 'pending_inventory';
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

  // --- [MODIFIED] This hook now re-runs when activeQuickFilter changes ---
  useEffect(() => {
    fetchQueueCounts();
    loadBookings();
  }, [loadBookings, fetchQueueCounts, activeQuickFilter]); // Added activeQuickFilter

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
  
  const handleQuickFilterChange = (newFilterId) => {
    setActiveQuickFilter(newFilterId);
    setSearchTerm('');
    setDateFilters({ startDate: '', endDate: '' });
    // fetchQueueCounts(); // This is now handled by the main useEffect
  };
  
  const handleClearFilters = () => {
    setSearchTerm('');
    setDateFilters({ startDate: '', endDate: '' });
  };
  
  const reloadAllData = () => {
    fetchQueueCounts();
    loadBookings();
  };

  // --- Confirmation Handlers (Unchanged) ---
  
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
      reloadAllData();
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
      reloadAllData();
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
      reloadAllData();
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
      reloadAllData();
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
      reloadAllData();
    } catch (error) {
      console.error('Error marking booking as paid:', error);
      setToast({ type: 'error', message: `Payment update failed: ${error.message}` });
    }
  };

  const populatedQuickFilters = [
    { 
      id: 'action_required', 
      label: 'Action Required',
      badge: queueCounts.action_required,
      badgeType: 'destructive'
    },
    { 
      id: 'pending_inventory', 
      label: 'Pending Inventory',
      badge: queueCounts.pending_inventory,
      badgeType: 'destructive'
    },
    { 
      id: 'pay_on_arrival', 
      label: 'Pay on Arrival',
      badge: queueCounts.pay_on_arrival,
      badgeType: 'informational'
    },
    { id: 'seat_confirmed', label: 'Confirmed', badge: 0, badgeType: 'informational' },
    { id: 'all', label: 'All Bookings', badge: 0, badgeType: 'informational' },
    { id: 'seat_cancelled', label: 'Cancelled', badge: 0, badgeType: 'informational' },
  ];
  
  const isActionView = activeQuickFilter === 'action_required' || activeQuickFilter === 'pending_inventory';

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

      {/* --- Render the extracted Filter Bar --- */}
      <BookingFilter
        activeQuickFilter={activeQuickFilter}
        populatedQuickFilters={populatedQuickFilters}
        dateFilters={dateFilters}
        onDateFiltersChange={setDateFilters}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        isSearchOpen={isSearchOpen}
        onIsSearchOpenChange={setIsSearchOpen}
        onQuickFilterChange={handleQuickFilterChange}
        onClearFilters={handleClearFilters}
      />
      
      {/* --- Render the extracted Results List --- */}
      <BookingList
        loading={loading}
        bookings={bookings}
        isActionView={isActionView}
        onBookingSelect={setModalBooking}
      />

      {/* --- Render the Action Modal --- */}
      {modalBooking && (
        <BookingActionModal
          booking={modalBooking}
          onClose={() => setModalBooking(null)}
          onTriggerAction={handleActionClick}
          isActionView={isActionView} 
        />
      )}

      {/* --- ALL CONFIRMATION DIALOGS --- */}
      
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
        <div className={styles.dialogForm}>
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
         <div className={styles.dialogForm}>
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
        <div className={styles.dialogForm}>
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