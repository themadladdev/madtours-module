// client/src/ui/calendar/CustomCalendar.jsx
import React, { useState, useMemo } from 'react';
import styles from './CustomCalendar.module.css';

// Helper: Pads a number to two digits (e.g., 1 -> "01")
const pad = (n) => String(n).padStart(2, '0');

// Helper: Formats a Date object to "YYYY-MM-DD"
const toYYYYMMDD = (date) => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * A from-scratch, multi-select calendar picker.
 * Adheres to the "Build It Yourself" standard.
 * @param {object} props
 * @param {string[]} props.selectedDates - Array of "YYYY-MM-DD" strings
 * @param {function} props.onDatesChange - Callback with new dates array
 */
const CustomCalendar = ({ selectedDates, onDatesChange }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const grid = useMemo(() => {
    const cells = [];
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startDate = firstDay.getDay(); // 0 = Sun, 1 = Mon
    const numDays = lastDay.getDate();

    // 1. Add padding cells for the start
    for (let i = 0; i < startDate; i++) {
      cells.push({ key: `pad-${i}`, padding: true });
    }

    // 2. Add day cells
    for (let i = 1; i <= numDays; i++) {
      const date = new Date(year, month, i);
      const dateString = toYYYYMMDD(date);
      cells.push({
        key: dateString,
        padding: false,
        day: i,
        dateString: dateString,
        isSelected: selectedDates.includes(dateString),
      });
    }
    return cells;
  }, [currentMonth, selectedDates]);

  const changeMonth = (amount) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));
  };

  const handleDateClick = (dateString) => {
    let newDates;
    if (selectedDates.includes(dateString)) {
      newDates = selectedDates.filter(d => d !== dateString);
    } else {
      newDates = [...selectedDates, dateString];
    }
    onDatesChange(newDates.sort());
  };

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <button type="button" onClick={() => changeMonth(-1)}>&larr;</button>
        <span className={styles.monthName}>
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button type="button" onClick={() => changeMonth(1)}>&rarr;</button>
      </div>
      <div className={styles.grid}>
        <div className={styles.dayOfWeek}>Sun</div>
        <div className={styles.dayOfWeek}>Mon</div>
        <div className={styles.dayOfWeek}>Tue</div>
        <div className={styles.dayOfWeek}>Wed</div>
        <div className={styles.dayOfWeek}>Thu</div>
        <div className={styles.dayOfWeek}>Fri</div>
        <div className={styles.dayOfWeek}>Sat</div>
        {grid.map(cell => (
          <div
            key={cell.key}
            className={`${styles.dayCell} ${cell.padding ? styles.padding : ''} ${cell.isSelected ? styles.selected : ''}`}
            onClick={() => !cell.padding && handleDateClick(cell.dateString)}
          >
            {cell.day}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomCalendar;