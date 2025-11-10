// client/src/modules/MADTours/handlers/verifyStripePayment.js
import * as tourBookingService from '../../../services/public/tourBookingService.js';

/**
 * This is the MADTours-specific handler.
 * It's called by the generic Module_PaymentResultHandler (Vanilla).
 *
 * @param {URLSearchParams} params - The URL parameters from the page.
 * @returns {Promise<object>} A result object with status and message.
 */
export const handleStripeVerification = async (params) => {
  const paymentIntentId = params.get('payment_intent');
  const redirectStatus = params.get('redirect_status');

  if (!paymentIntentId) {
    return {
      status: 'error',
      title: 'Verification Error',
      message: 'No Payment Intent ID was found in the URL. Cannot verify payment.'
    };
  }
  
  // This is an immediate failure (e.g., card declined)
  if (redirectStatus === 'failed') {
     return {
      status: 'error',
      title: 'Payment Failed',
      message: 'Your payment was not successful. Please try again or contact support.'
    };
  }
  
  // This is a success, but we MUST verify it with the server
  // to be 100% sure and to confirm the booking.
  if (redirectStatus === 'succeeded') {
    try {
      const result = await tourBookingService.verifyBookingPayment(paymentIntentId);
      
      // The server confirmed the payment
      if (result.status === 'succeeded') {
        return {
          status: 'success',
          title: 'Booking Confirmed!',
          message: `Your payment was successful. Your booking reference is: ${result.bookingReference}`
        };
      } else {
        // The server said the payment status was not 'succeeded'
        return {
          status: 'error',
          title: 'Payment Not Confirmed',
          message: result.message || 'Your payment was received but could not be confirmed. Please contact support.'
        };
      }
      
    } catch (err) {
      // The API call itself failed
      return {
        status: 'error',
        title: 'Verification Failed',
        message: err.message || 'An error occurred while verifying your payment. Please contact support with your Payment ID.'
      };
    }
  }

  // Fallback for unknown status
  return {
    status: 'error',
    title: 'Unknown Payment Status',
    message: `The redirect status was: ${redirectStatus}. Please contact support.`
  };
};