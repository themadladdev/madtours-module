// client/src/ui/MADTours/WidgetComponents/TimeSlotSelector/TimeSlotSelector.jsx
import React from 'react';
import styles from './TimeSlotSelector.module.css';
import sharedStyles from '../../Widgets/TicketBookingWidget/TicketBookingWidget.module.css'; // Borrowing some styles

const TimeSlotSelector = ({ slots, selectedTime, onTimeClick }) => {
  if (!slots || slots.length === 0) {
    return null;
  }
  
  return (
    <div className={sharedStyles.stepContent}>
      <h4 className={sharedStyles.stepTitle}>Select a Time</h4>
      <div className={styles.timeSlotGrid}>
        {slots.map(slot => (
          <button
            key={slot.time}
            className={`${styles.timeSlotButton} ${selectedTime === slot.time.substring(0, 5) ? styles.selected : ''}`}
            onClick={() => onTimeClick(slot.time)} // Pass full time up
          >
            <span className={styles.slotTime}>{slot.time.substring(0, 5)}</span>
            <span className={styles.slotSeats}>{slot.availableSeats} seats</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TimeSlotSelector;