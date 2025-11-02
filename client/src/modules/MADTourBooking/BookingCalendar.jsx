// ==========================================
// PUBLIC: Booking Calendar
// client/src/modules/MADTourBooking/BookingCalendar.jsx
// ==========================================

import React, { useState, useEffect } from 'react';
import { getActiveTours, getTourAvailability } from '../../services/public/tourBookingService.js';
import styles from './BookingCalendar.module.css';

const BookingCalendar = ({ onSelectTour }) => {
  const [tours, setTours] = useState([]);
  const [selectedTour, setSelectedTour] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availability, setAvailability] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState(2);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTours();
  }, []);

  useEffect(() => {
    if (selectedTour) {
      loadAvailability();
    }
  }, [selectedTour, currentMonth, selectedSeats]);

  const loadTours = async () => {
    try {
      const data = await getActiveTours();
      setTours(data);
      if (data.length > 0) {
        setSelectedTour(data[0]);
      }
    } catch (error) {
      console.error('Error loading tours:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = async () => {
    try {
      const month = currentMonth.toISOString().slice(0, 7); // YYYY-MM
      const data = await getTourAvailability(selectedTour.id, month, selectedSeats);
      setAvailability(data);
    } catch (error) {
      console.error('Error loading availability:', error);
    }
  };

  const handleSelectInstance = (instance) => {
    onSelectTour({
      tour: selectedTour,
      instance,
      seats: selectedSeats
    });
  };

  const changeMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
  };

  const groupByDate = (instances) => {
    return instances.reduce((acc, instance) => {
      const date = instance.date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(instance);
      return acc;
    }, {});
  };

  if (loading) return <div className={styles.loading}>Loading tours...</div>;

  const groupedAvailability = groupByDate(availability);
  const dates = Object.keys(groupedAvailability).sort();

  return (
    <div className={styles.bookingCalendar}>
      <div className={styles.header}>
        <h2>Book Your Tour</h2>
      </div>

      <div className={styles.tourSelector}>
        <label>Select Tour:</label>
        <select 
          value={selectedTour?.id || ''} 
          onChange={(e) => setSelectedTour(tours.find(t => t.id === parseInt(e.target.value)))}
        >
          {tours.map(tour => (
            <option key={tour.id} value={tour.id}>
              {tour.name} - ${tour.base_price}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.seatsSelector}>
        <label>Number of Guests:</label>
        <input 
          type="number" 
          min="1" 
          max="15" 
          value={selectedSeats}
          onChange={(e) => setSelectedSeats(parseInt(e.target.value))}
        />
      </div>

      <div className={styles.monthNav}>
        <button onClick={() => changeMonth(-1)}>← Previous</button>
        <h3>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
        <button onClick={() => changeMonth(1)}>Next →</button>
      </div>

      <div className={styles.availabilityList}>
        {dates.length === 0 ? (
          <p className={styles.noAvailability}>
            No available tours for {selectedSeats} guests in this month.
            Try fewer guests or a different month.
          </p>
        ) : (
          dates.map(date => (
            <div key={date} className={styles.dateGroup}>
              <h4>{new Date(date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
              })}</h4>
              <div className={styles.timeSlots}>
                {groupedAvailability[date].map(instance => (
                  <button
                    key={instance.id}
                    className={styles.timeSlot}
                    onClick={() => handleSelectInstance(instance)}
                  >
                    <span className={styles.time}>{instance.time}</span>
                    <span className={styles.seats}>
                      {instance.available_seats} seats available
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BookingCalendar;