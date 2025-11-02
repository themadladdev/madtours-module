// client/src/ui/dialogbox/ConfirmationDialog.jsx
import styles from './ConfirmationDialog.module.css';

const ConfirmationDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  isDestructive = false 
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.modal}>
      <div className={styles.modalOverlay} onClick={onClose}></div>
      
      <div className={styles.modalContent}>
        
        <div className={styles.modalHeader}>
          <h3>{title}</h3>
          <button 
            className={styles.closeButton} 
            onClick={onClose}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className={styles.modalBody}>
          {/* Handle newline characters in the message */}
          {message && message.split('\n').map((line, index) => (
            <span key={index} className={styles.messageLine}>
              {line}
            </span>
          ))}
          
          <div className={styles.formActions}>
            <button
              onClick={onClose}
              className={styles.cancelButton}
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={isDestructive ? styles.deleteButton : styles.submitButton}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;