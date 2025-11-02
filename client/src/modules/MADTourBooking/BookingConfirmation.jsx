// ==========================================
// PUBLIC: Booking Confirmation
// client/src/modules/MADTourBooking/BookingConfirmation.jsx
// ==========================================

import React, { useEffect, useState } from 'react';
import { getBookingByReference } from '../../services/public/tourBookingService.js';
import styles from './BookingConfirmation.module.css';

const BookingConfirmation = ({ bookingReference }) => {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (bookingReference) {
      loadBooking();
    }
  }, [bookingReference]);

  const loadBooking = async () => {
    try {
      const data = await getBookingByReference(bookingReference);
      setBooking(data);
    } catch (error) {
      console.error('Error loading booking:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (!booking) return <div className={styles.error}>Booking not found</div>;

  return (
    <div className={styles.confirmation}>
      <div className={styles.successIcon}>✓</div>
      
      <h1>Booking Confirmed!</h1>
      
      <p className={styles.message}>
        Thank you for your booking. A confirmation email has been sent to {booking.email}
      </p>

      <div className={styles.bookingDetails}>
        <h2>Booking Details</h2>
        
        <div className={styles.reference}>
          <strong>Booking Reference:</strong>
          <span className={styles.refCode}>{booking.booking_reference}</span>
        </div>

        <div className={styles.detailsGrid}>
          <div className={styles.detail}>
            <strong>Tour:</strong>
            <span>{booking.tour_name}</span>
          </div>
          <div className={styles.detail}>
            <strong>Date:</strong>
            <span>{new Date(booking.date).toLocaleDateString()}</span>
          </div>
          <div className={styles.detail}>
            <strong>Time:</strong>
            <span>{booking.time}</span>
          </div>
          <div className={styles.detail}>
            <strong>Duration:</strong>
            <span>{booking.duration_minutes} minutes</span>
          </div>
          <div className={styles.detail}>
            <strong>Guests:</strong>
            <span>{booking.seats}</span>
          </div>
          <div className={styles.detail}>
            <strong>Total Paid:</strong>
            <span>${booking.total_amount}</span>
          </div>
        </div>

        <div className={styles.customerInfo}>
          <h3>Customer Information</h3>
          <p><strong>Name:</strong> {booking.first_name} {booking.last_name}</p>
          <p><strong>Email:</strong> {booking.email}</p>
          <p><strong>Phone:</strong> {booking.phone}</p>
        </div>

        {booking.special_requests && (
          <div className={styles.specialRequests}>
            <h3>Special Requests</h3>
            <p>{booking.special_requests}</p>
          </div>
        )}
      </div>

      <div className={styles.nextSteps}>
        <h3>What's Next?</h3>
        <ul>
          <li>You'll receive a confirmation email shortly</li>
          <li>A reminder will be sent 24 hours before your tour</li>
          <li>Please arrive 15 minutes early</li>
          <li>Bring your booking reference: <strong>{booking.booking_reference}</strong></li>
        </ul>
      </div>

      <div className={styles.actions}>
        <button 
          onClick={() => window.print()} 
          className={styles.btnSecondary}
        >
          Print Confirmation
        </button>
        <button 
          onClick={() => window.location.href = '/'} 
          className={styles.btnPrimary}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default BookingConfirmation;