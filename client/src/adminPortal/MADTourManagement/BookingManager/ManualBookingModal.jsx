// client/src/adminPortal/MADTourManagement/BookingManager/ManualBookingModal.jsx
import React from 'react';
import AdminFormModal from '../../../MADLibrary/admin/modals/AdminFormModal.jsx';
import AdminBookingWidget from '../../../MADLibrary/MADTours/Widgets/AdminBookingWidget/AdminBookingWidget.jsx';

/**
 * This component is now a simple host for the AdminBookingWidget.
 * It passes in the initial context (if any) and handles the final
 * success/close events.
 */
const ManualBookingModal = ({ 
    isOpen, 
    onClose, 
    initialTourId = null, 
    initialDate = null, 
    initialTime = null 
}) => {

    // This function will be called by the widget on a successful booking
    const handleBookingSuccess = () => {
        // We call onClose, which in ManifestView is wired to reload the manifest
        onClose(); 
    };

    return (
        <AdminFormModal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={initialTourId ? "Add Booking to Manifest" : "Create New Manual Booking"}
        >
            {/* Render the smart widget inside the modal.
              We pass the initial context props directly to the widget.
            */}
            <AdminBookingWidget
                initialTourId={initialTourId}
                initialDate={initialDate}
                initialTime={initialTime}
                onBookingSuccess={handleBookingSuccess}
                onClose={onClose}
            />
        </AdminFormModal>
    );
};

export default ManualBookingModal;