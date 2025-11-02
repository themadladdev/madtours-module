// ==========================================
// PUBLIC: Booking Lookup
// client/src/modules/TourBooking/BookingLookup.jsx
// ==========================================

import React, { useState } from 'react';
import { getBookingByReference } from '../../services/public/tourBookingService.js';
import styles from './BookingLookup.module.css';

const BookingLookup = () => {
  const [reference, setReference] = useState('');
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setBooking(null);

    try {
      const data = await getBookingByReference(reference.toUpperCase().trim());
      setBooking(data);
    } catch (err) {
      setError('Booking not found. Please check your reference and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.lookupContainer}>
      <h2>Find Your Booking</h2>
      
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputGroup}>
          <label>Booking Reference</label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Enter your 8-character reference"
            maxLength="8"
            required
          />
        </div>
        
        <button 
          type="submit" 
          className={styles.btnPrimary}
          disabled={loading || reference.length < 8}
        >
          {loading ? 'Searching...' : 'Find Booking'}
        </button>
      </form>

      {error && <div className={styles.error}>{error}</div>}

      {booking && (
        <div className={styles.bookingResult}>
          <div className={styles.statusBadge}>
            <span className={`${styles.status} ${styles[booking.status]}`}>
              {booking.status}
            </span>
          </div>

          <h3>{booking.tour_name}</h3>
          
          <div className={styles.details}>
            <div className={styles.detailRow}>
              <strong>Date:</strong>
              <span>{new Date(booking.date).toLocaleDateString()}</span>
            </div>
            <div className={styles.detailRow}>
              <strong>Time:</strong>
              <span>{booking.time}</span>
            </div>
            <div className={styles.detailRow}>
              <strong>Guests:</strong>
              <span>{booking.seats}</span>
            </div>
            <div className={styles.detailRow}>
              <strong>Total:</strong>
              <span>${booking.total_amount}</span>
            </div>
            <div className={styles.detailRow}>
              <strong>Payment:</strong>
              <span className={styles[booking.payment_status]}>
                {booking.payment_status}
              </span>
            </div>
          </div>

          <div className={styles.customerDetails}>
            <h4>Contact Information</h4>
            <p>{booking.first_name} {booking.last_name}</p>
            <p>{booking.email}</p>
            <p>{booking.phone}</p>
          </div>

          {booking.special_requests && (
            <div className={styles.specialRequests}>
              <h4>Special Requests</h4>
              <p>{booking.special_requests}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BookingLookup;