// client/src/prototypeshowcase/PrototypeShowcase.jsx
import React, { useState } from 'react';
import styles from './PrototypeShowcase.module.css';

// Import all the components we built
import TourCollectionPage from '../modules/MADTours/TourCollectionPage/TourCollectionPage.jsx';
import AvailabilityWidget from '../modules/MADTours/AvailabilityWidget/AvailabilityWidget.jsx';
import FeaturedTourWidget from '../modules/MADTours/FeaturedTourWidget/FeaturedTourWidget.jsx';
import TourDetailPage from '../modules/MADTours/TourDetailPage/TourDetailPage.jsx';
import BookingCalendar from '../modules/MADTours/BookingCalendar/BookingCalendar.jsx';
import AvailabilityBookingWidget from '../modules/MADTours/AvailabilityBookingWidget/AvailabilityBookingWidget.jsx';

// --- Component List for the Menu ---
const components = [
  { id: 'TourCollectionPage', label: 'Tour Collection Page (Item 3)' },
  { id: 'AvailabilityWidget', label: 'Availability Widget (Item 1)' },
  { id: 'FeaturedTourWidget', label: 'Featured Tour Widget (Item 2)' },
  { id: 'TourDetailPage', label: 'Tour Detail Page (Item 4)' },
  { id: 'BookingCalendar', label: 'Booking Calendar Widget (Item 5)' },
  { id: 'AvailabilityBookingWidget', label: 'Combined "Super" Widget' },
];

const PrototypeShowcase = () => {
  const [activeComponentId, setActiveComponentId] = useState('TourCollectionPage');

  const renderActiveComponent = () => {
    switch (activeComponentId) {
      case 'TourCollectionPage':
        return <TourCollectionPage />;
      case 'AvailabilityWidget':
        return <AvailabilityWidget />;
      case 'FeaturedTourWidget':
        // --- FIX: Hard-coded tourId updated from 1 to 3 ---
        return <FeaturedTourWidget tourId={3} />;
      case 'TourDetailPage':
        // --- FIX: Hard-coded id updated from 1 to 3 ---
        return <TourDetailPage id={3} />;
      case 'BookingCalendar':
        // --- FIX: Hard-coded props updated from 1 to 3 ---
        return (
          <BookingCalendar
            tourId={3}
            basePrice="50.00" // Updated to match DB
            defaultDate={null}
            defaultGuests={1}
          />
        );
      case 'AvailabilityBookingWidget':
        return <AvailabilityBookingWidget />;
      default:
        return <p>Select a component to view.</p>;
    }
  };

  return (
    <div className={styles.showcaseContainer}>
      {/* --- Sidebar Menu --- */}
      <nav className={styles.sidebar}>
        <h2 className={styles.sidebarTitle}>Prototype Showcase</h2>
        <p className={styles.sidebarDescription}>
          Rendering components from `/client/src/modules/MADTours/`
        </p>
        <ul className={styles.menuList}>
          {components.map(component => (
            <li key={component.id}>
              <button
                className={`${styles.menuButton} ${
                  activeComponentId === component.id ? styles.active : ''
                }`}
                onClick={() => setActiveComponentId(component.id)}
              >
                {component.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* --- Main Content Sandbox --- */}
      <main className={styles.content}>
        <div className={styles.sandbox}>
          {renderActiveComponent()}
        </div>
      </main>
    </div>
  );
};

export default PrototypeShowcase;