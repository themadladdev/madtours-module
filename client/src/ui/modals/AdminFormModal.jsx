// client/src/ui/modals/AdminFormModal.jsx
import React from 'react';
import styles from './AdminFormModal.module.css';

/**
 * A simple, self-contained modal wrapper.
 * It renders a header and a body.
 * The form inside 'children' is responsible for its own buttons and layout.
 */
const AdminFormModal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) {
        return null;
    }

    return (
        <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className={styles.modalOverlay} onClick={onClose}></div>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h3 id="modal-title" className={styles.modalTitle}>{title}</h3>
                    <button 
                        className={styles.closeButton} 
                        onClick={onClose} 
                        aria-label="Close"
                    >
                        &times;
                    </button>
                </div>
                <div className={styles.modalBody}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default AdminFormModal;