// ==========================================
// UPDATED FILE
// client/src/adminPortal/MADTourManagement/BookingManager/BookingList.jsx
// ==========================================
import React from 'react';
import styles from './BookingList.module.css';
import sharedStyles from '../../../MADLibrary/admin/styles/adminshared.module.css';

const BookingList = ({ loading, bookings, isActionView, onBookingSelect }) => {
  
  const getBadgeClass = (status) => {
    switch (status) {
      // Seat Statuses
      case 'seat_confirmed':
        return styles.seat_confirmed;
      case 'seat_pending':
        return styles.seat_pending;
      case 'seat_cancelled':
        return styles.seat_cancelled;
      case 'triage':
        return styles.triage;
      case 'seat_noshow':
        return styles.seat_noshow;
        
      // Payment Statuses
      case 'payment_stripe_success':
      case 'payment_manual_success':
        return styles.payment_success;
        
      case 'payment_stripe_pending':
      case 'payment_manual_pending':
        return styles.payment_pending;

      case 'payment_foc':
        return styles.payment_foc;
        
      case 'refund_stripe_pending':
        return styles.refund_pending;

      case 'refund_stripe_success':
      case 'refund_manual_success':
        return styles.refund_success;
        
      case 'refund_stripe_failed':
        return styles.refund_failed;

      case 'payment_none':
      default:
        return styles.payment_none;
    }
  };

  const getActionReason = (booking) => {
    if (booking.seat_status === 'triage') return "Triage";
    if (booking.payment_status === 'refund_stripe_failed') return "Refund Failed";
    // --- [MODIFIED] Renamed "Stuck Hostage" ---
    if (booking.seat_status === 'seat_pending') return "Inventory Held";
    if (booking.payment_status === 'payment_manual_pending') return "Missed Payment";
    return "N/A";
  };
  
  if (loading) {
    return (
      <div className={sharedStyles.contentBox}>
        <div className={sharedStyles.loadingContainer}>
          <div className={sharedStyles.spinner}></div>
        </div>
      </div>
    );
  }

  return (
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
            {isActionView && <th className={styles.textCenter}>Action</th>}
          </tr>
        </thead>
        <tbody>
          {bookings.length === 0 ? (
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
                onClick={() => onBookingSelect(booking)}
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
                  <span className={`${styles.badge} ${getBadgeClass(booking.seat_status)}`}>
                    {booking.seat_status}
                  </span>
                </td>
                <td className={styles.textCenter}>
                  <span className={`${styles.badge} ${getBadgeClass(booking.payment_status)}`}>
                    {booking.payment_status}
                  </span>
                </td>
                
                {isActionView && (
                  <td className={`${styles.reason} ${styles.textCenter}`}>
                    {getActionReason(booking)}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
      
      {/* --- Mobile Card List --- */}
      <div className={styles.mobileCardList}>
        {bookings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            No bookings found for this view.
          </div>
        ) : (
          bookings.map(booking => (
            <div 
              key={booking.id} 
              className={styles.bookingCard}
              onClick={() => onBookingSelect(booking)}
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
                  <span className={`${styles.badge} ${getBadgeClass(booking.seat_status)}`}>
                    {booking.seat_status}
                  </span>
                </div>
                <div className={styles.cardStatusItem}>
                  <label>Payment</label>
                  <span className={`${styles.badge} ${getBadgeClass(booking.payment_status)}`}>
                    {booking.payment_status}
                  </span>
                </div>
              </div>

              {isActionView && (
                <div className={styles.cardReason}>
                  <strong>Action:</strong> {getActionReason(booking)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BookingList;