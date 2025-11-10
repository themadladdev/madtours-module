// client/src/MADLibrary/MADTours/WidgetComponents/StripePaymentForm/StripePaymentForm.jsx
import React, { useState, useEffect } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import styles from './StripePaymentForm.module.css';

const StripePaymentForm = ({ bookingRef, totalAmount, onPaymentSuccess, onPaymentError }) => {
  const stripe = useStripe();
  const elements = useElements();

  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not yet loaded.
      return;
    }

    setIsLoading(true);

    // --- [FIX] ---
    // Updated the return_url to point to your new /payment-result page.
    // We also add the 'handler' query param so the page knows
    // which bolt-on logic to run (the "madtours-verify" handler).
    const returnUrl = `${window.location.origin}/payment-result?handler=madtours-verify`;
    // --- [END FIX] ---

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Use the new, correct return_url
        return_url: returnUrl,
      },
      // We are redirecting, so the result is handled on the return_url
      // *unless* there's an immediate error.
    });

    // This code block will only be reached if there is an *immediate* error
    // (e.g., network failure) *before* redirecting.
    if (error.type === "card_error" || error.type === "validation_error") {
      setMessage(error.message);
      onPaymentError(error.message); // Notify parent
    } else {
      setMessage("An unexpected error occurred.");
      onPaymentError("An unexpected error occurred."); // Notify parent
    }

    setIsLoading(false);
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit} className={styles.paymentForm}>
      <div className={styles.summary}>
        <span>Booking Reference:</span>
        <strong>{bookingRef}</strong>
      </div>
      <div className={styles.summary}>
        <span>Total Amount:</span>
        <strong>${totalAmount.toFixed(2)}</strong>
      </div>

      {/* This is the pre-built Stripe form for card, Apple Pay, Google Pay, etc. */}
      <PaymentElement id="payment-element" className={styles.paymentElement} />

      <button disabled={isLoading || !stripe || !elements} id="submit" className={styles.payButton}>
        <span id="button-text">
          {isLoading ? <div className={styles.spinner}></div> : `Pay $${totalAmount.toFixed(2)}`}
        </span>
      </button>
      
      {/* Show any error or success messages */}
      {message && <div id="payment-message" className={styles.paymentMessage}>{message}</div>}
    </form>
  );
};

export default StripePaymentForm;