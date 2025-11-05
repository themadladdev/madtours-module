// client/src/ui/MADTours/WidgetComponents/BookingCalendar/BookingCalendar.jsx
import React from 'react';
import styles from './BookingCalendar.module.css';

// --- Helper Functions (Moved from widget) ---
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// ---

/**
 * A "dumb" reusable calendar component.
 * It receives availability and state from a parent "smart" widget.
 */
const BookingCalendar = ({ 
  currentMonth, 
  currentYear, 
  availability, 
  selectedDate, 
  onDateClick, 
  onMonthChange 
}) => {

  // --- Calendar Grid Generation ---
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const calendarGrid = [];
  
  // Add empty cells for the start of the month
  for (let i = 0; i < firstDay; i++) {
    calendarGrid.push(<div key={`empty-${i}`} className={styles.calendarDayEmpty}></div>);
  }
  
  // Add cells for each day
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isAvailable = !!availability[dateKey];
    const isSelected = selectedDate === dateKey;
    
    calendarGrid.push(
      <button
        key={`day-${day}`}
        className={`${styles.calendarDay} ${isAvailable ? styles.available : ''} ${isSelected ? styles.selected : ''}`}
        onClick={() => onDateClick(day)} // Pass the day up
        disabled={!isAvailable}
      >
        {day}
      </button>
    );
  }
  // --- End Grid Generation ---

  return (
    <div className={styles.calendarSection}>
      <div className={styles.monthNavigator}>
        <button onClick={() => onMonthChange(-1)}>&larr;</button>
        <span className={styles.monthName}>
          {monthNames[currentMonth]} {currentYear}
        </span>
        <button onClick={() => onMonthChange(1)}>&rarr;</button>
      </div>
      
      <div className={styles.calendarGrid}>
        <div className={styles.calendarHeader}>Sun</div>
        <div className={styles.calendarHeader}>Mon</div>
        <div className={styles.calendarHeader}>Tue</div>
        <div className={styles.calendarHeader}>Wed</div>
        <div className={styles.calendarHeader}>Thu</div>
        <div className={styles.calendarHeader}>Fri</div>
        <div className={styles.calendarHeader}>Sat</div>
        {calendarGrid}
      </div>
    </div>
  );
};

export default BookingCalendar;