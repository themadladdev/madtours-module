// ==========================================
// NEW FILE
// client/src/adminPortal/MADTourManagement/Manifest/ManifestEditorModal.jsx
// ==========================================

import React, { useState, useEffect } from 'react';
import AdminFormModal from '../../../MADLibrary/admin/modals/AdminFormModal.jsx';
import { updateBookingPassengers } from '../../../services/admin/adminBookingService.js';
import styles from './ManifestEditorModal.module.css';
import sharedStyles from '../../adminshared.module.css';

/**
 * Renders a modal to edit passenger names for a specific booking.
 * It handles both "low-friction" (payer only) and "high-detail" (all names) bookings.
 */
const ManifestEditorModal = ({ isOpen, onClose, booking, onSaveSuccess }) => {
    const [passengers, setPassengers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (booking) {
            initializePassengerState(booking);
        }
    }, [booking]);

    /**
     * Creates the full list of passenger inputs, filling in existing data
     * and creating empty slots up to the total seat count.
     */
    const initializePassengerState = (bookingData) => {
        const existingPassengers = bookingData.passengers || [];
        const totalSeats = bookingData.seats_total;
        const newPassengerList = [];

        for (let i = 0; i < totalSeats; i++) {
            if (i < existingPassengers.length) {
                // Use existing passenger data
                newPassengerList.push({
                    id: existingPassengers[i].id || null, // ID from DB if it exists
                    first_name: existingPassengers[i].first_name,
                    last_name: existingPassengers[i].last_name,
                    // Use the existing ticket_type as the base
                    ticket_type: existingPassengers[i].ticket_type 
                });
            } else {
                // Create a new, empty passenger slot
                newPassengerList.push({
                    id: null,
                    first_name: '',
                    last_name: '',
                    // This new passenger will get a "Passenger X" ticket type on save
                    ticket_type: null 
                });
            }
        }
        setPassengers(newPassengerList);
    };

    /**
     * Handle input change for a specific passenger by their index.
     */
    const handlePassengerChange = (index, field, value) => {
        const updatedPassengers = [...passengers];
        updatedPassengers[index][field] = value;
        setPassengers(updatedPassengers);
    };

    /**
     * Handles the form submission.
     */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // 1. Filter out any completely empty rows
        const validPassengers = passengers.filter(p => 
            p.first_name.trim() !== '' || p.last_name.trim() !== ''
        );

        // 2. Prepare payload, assigning standardized ticket_type
        const passengerPayload = validPassengers.map((p, index) => {
            let ticketType = p.ticket_type;

            // Standardize ticket types on save
            if (index === 0) {
                // First passenger is always "Passenger 1 (Payer)"
                ticketType = 'Passenger 1 (Payer)';
            } else if (!ticketType || ticketType === 'Payer') {
                // New or standardized passengers
                ticketType = `Passenger ${index + 1}`;
            }
            
            return {
                id: p.id, // null for new passengers, ID for existing
                first_name: p.first_name,
                last_name: p.last_name,
                ticket_type: ticketType
            };
        });

        try {
            await updateBookingPassengers(booking.booking_id, passengerPayload);
            setLoading(false);
            onSaveSuccess(); // Trigger a reload in the parent
            onClose(); // Close the modal
        } catch (err) {
            setError(err.message || 'Failed to update passengers.');
            setLoading(false);
        }
    };

    if (!booking) return null;

    return (
        <AdminFormModal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Edit Passengers (Ref: ${booking.booking_reference})`}
        >
            <form onSubmit={handleSubmit}>
                <div className={styles.modalBody}>
                    <p className={styles.instructions}>
                        Update passenger names for this booking. You have a total of 
                        <strong> {booking.seats_total}</strong> seat(s) allocated.
                    </p>
                    
                    {error && (
                        <div className={sharedStyles.errorMessage}>{error}</div>
                    )}

                    <div className={styles.passengerList}>
                        {passengers.map((passenger, index) => (
                            <div key={index} className={styles.passengerRow}>
                                <label className={styles.passengerLabel}>
                                    Passenger {index + 1}
                                </label>
                                <div className={styles.passengerInputs}>
                                    <input
                                        type="text"
                                        placeholder="First Name"
                                        className={sharedStyles.input}
                                        value={passenger.first_name}
                                        onChange={(e) => handlePassengerChange(index, 'first_name', e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Last Name"
                                        className={sharedStyles.input}
                                        value={passenger.last_name}
                                        onChange={(e) => handlePassengerChange(index, 'last_name', e.target.value)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className={styles.modalFooter}>
                    <button 
                        type="button" 
                        className={sharedStyles.secondaryButton} 
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        className={sharedStyles.primaryButton}
                        disabled={loading}
                    >
                        {loading ? 'Saving...' : 'Save Passengers'}
                    </button>
                </div>
            </form>
        </AdminFormModal>
    );
};

export default ManifestEditorModal;