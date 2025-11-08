// client/src/MADLibrary/MADTours/WidgetComponents/TicketSelector/TicketSelector.jsx
import React from 'react';
import styles from './TicketSelector.module.css';
import sharedStyles from '../../Widgets/TicketBookingWidget/TicketBookingWidget.module.css';

const TicketSelector = ({ 
  pricing, 
  ticketSelection, 
  onTicketChange, 
  onContinue, 
  totalSelectedSeats, 
  availableSeats, 
  totalAmount 
}) => {

  return (
    <div className={sharedStyles.stepContent}>
      <div className={sharedStyles.stepHeader}>
        <h4 className={sharedStyles.stepTitle}>Select Tickets</h4>
        <span className={sharedStyles.availability}>
          {totalSelectedSeats} / {availableSeats} seats
        </span>
      </div>
      
      {pricing.map(ticket => (
        <div key={ticket.ticket_id} className={styles.ticketRow}>
          <div className={styles.ticketInfo}>
            <span className={styles.ticketName}>{ticket.ticket_name}</span>
            <span className={styles.ticketPrice}>${parseFloat(ticket.price).toFixed(2)}</span>
          </div>
          <input
            type="number"
            min="0"
            step="1"
            className={styles.ticketInput}
            value={ticketSelection.find(t => t.ticket_id === ticket.ticket_id)?.quantity || 0}
            onChange={(e) => onTicketChange(ticket.ticket_id, e.target.value)}
          />
        </div>
      ))}
      
      {totalSelectedSeats > 0 && (
        <button 
          className={sharedStyles.bookButton} 
          onClick={onContinue}
          disabled={totalSelectedSeats > availableSeats}
        >
          {totalSelectedSeats > availableSeats ? 'Not Enough Seats' : `Continue ($${totalAmount.toFixed(2)})`}
        </button>
      )}
    </div>
  );
};

export default TicketSelector;