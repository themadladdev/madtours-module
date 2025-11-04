// client/src/modules/MADTours/BookingPage/BookingPage.jsx
import React, { useState, useEffect } from 'react';
import styles from './BookingPage.module.css';

const BookingPage = () => {
  const [bookingDetails, setBookingDetails] = useState(null);
  const [customerDetails, setCustomerDetails] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    specialRequests: '',
  });
  const [error, setError] = useState(null);

  // Standard navigation function for redirect
  const handleNavigate = (path) => {
    // We don't need 'event' here because it's a programmatic navigation
    window.history.pushState({}, '', path);
    window.dispatchEvent(new CustomEvent('route-change'));
  };

  useEffect(() => {
    // Try to load the booking details from session storage
    const storedDetails = sessionStorage.getItem('madtours_booking_details');

    if (!storedDetails) {
      setError('No booking details found. Please start over.');
      // Redirect back to the tours page after a short delay
      setTimeout(() => {
        handleNavigate('/tours');
      }, 3000);
      return;
    }

    try {
      const details = JSON.parse(storedDetails);
      // Add tour details to the state
      setBookingDetails(details);
    } catch (err) {
      setError('Could not read booking details. Please start over.');
      setTimeout(() => {
        handleNavigate('/tours');
      }, 3000);
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCustomerDetails((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmitBooking = (e) => {
    e.preventDefault();
    
    // Combine all data for the final booking object
    const finalBooking = {
      ...bookingDetails,
      customer: customerDetails,
    };

    console.log('STUB: Final Booking Object', finalBooking);

    // This is where we will call the booking service in the future
    alert('STUB: Booking submitted! Check the console for the final object.');
    
    // Clear the session storage and navigate to a success page (or back to home)
    sessionStorage.removeItem('madtours_booking_details');
    handleNavigate('/');
  };

  if (error) {
    return (
      <div className={styles.pageContainer}>
        <h1 className={styles.title}>Error</h1>
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  if (!bookingDetails) {
    // Show a simple loader while details are read
    return <div className={styles.pageContainer}>Loading...</div>;
  }

  return (
    <div className={styles.pageContainer}>
      <h1 className={styles.title}>Confirm Your Booking</h1>
      
      <div className={styles.contentGrid}>
        {/* --- Booking Summary Column --- */}
        <div className={styles.summaryBox}>
          <h2 className={styles.boxTitle}>Booking Summary</h2>
          {/* NEW: Display Tour Name */}
          <div className={styles.summaryItem}>
            <span>Tour:</span>
            <strong>{bookingDetails.tourName || `Tour ID: ${bookingDetails.tourId}`}</strong>
          </div>
          <div className={styles.summaryItem}>
            <span>Date:</span>
            {/* Use T00:00:00 to force local time interpretation */}
            <strong>{new Date(bookingDetails.date + 'T00:00:00').toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}</strong>
          </div>
          <div className={styles.summaryItem}>
            <span>Time:</span>
            <strong>{bookingDetails.time}</strong>
          </div>
          <div className={styles.summaryItem}>
            <span>Guests:</span>
            <strong>{bookingDetails.guests}</strong>
          </div>
          <div className={styles.summaryTotal}>
            <span>Total</span>
            <strong>${bookingDetails.totalAmount}</strong>
          </div>
        </div>

        {/* --- Customer Details Form Column --- */}
        <form className={styles.formBox} onSubmit={handleSubmitBooking}>
          <h2 className={styles.boxTitle}>Your Details</h2>
          
          <div className={styles.formGroup}>
            <label htmlFor="firstName">First Name</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              className={styles.input}
              value={customerDetails.firstName}
              onChange={handleInputChange}
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="lastName">Last Name</label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              className={styles.input}
              value={customerDetails.lastName}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              className={styles.input}
              value={customerDetails.email}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="phone">Phone</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              className={styles.input}
              value={customerDetails.phone}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="specialRequests">Special Requests (Optional)</label>
            <textarea
              id="specialRequests"
              name="specialRequests"
              className={styles.textarea}
              rows="4"
              value={customerDetails.specialRequests}
              onChange={handleInputChange}
            ></textarea>
          </div>

          <button type="submit" className={styles.confirmButton}>
            Confirm & Book
          </button>
        </form>
      </div>
    </div>
  );
};

export default BookingPage;