// ==========================================
// VALIDATION: Booking Form Enhancement
// client/src/modules/MADTourBooking/BookingForm.jsx (ADD VALIDATION)
// ==========================================

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validatePhone = (phone) => {
  // Australian phone number validation
  const re = /^(\+?61|0)[2-478](?:[ -]?[0-9]){8}$/;
  return re.test(phone.replace(/\s/g, ''));
};

// In handleSubmitDetails function, add validation before API call:
const handleSubmitDetails = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError('');

  // Validation
  if (!validateEmail(formData.email)) {
    setError('Please enter a valid email address');
    setLoading(false);
    return;
  }

  if (!validatePhone(formData.phone)) {
    setError('Please enter a valid Australian phone number');
    setLoading(false);
    return;
  }

  try {
    // ... existing booking creation code
  } catch (err) {
    setError(err.message || 'Failed to create booking');
  } finally {
    setLoading(false);
  }
};