// client/src/prototypeshowcase/PrototypeShowcase.jsx
import React, { useState } from 'react';
import styles from './PrototypeShowcase.module.css';

// --- NEW: Import the new controls component ---
import WidgetControls from './WidgetControls.jsx';

// --- Page ("Module") Imports ---
import TourCollectionPage from '../modules/MADTours/TourCollectionPage/TourCollectionPage.jsx';
import TourDetailPage from '../modules/MADTours/TourDetailPage/TourDetailPage.jsx';

// --- Widget ("UI Component") Imports (from new location) ---
import AvailabilityWidget from '../ui/MADTours/AvailabilityWidget/AvailabilityWidget.jsx';
import FeaturedTourWidget from '../ui/MADTours/FeaturedTourWidget/FeaturedTourWidget.jsx';
import BookingCalendar from '../ui/MADTours/BookingCalendar/BookingCalendar.jsx';
import AvailabilityBookingWidget from '../ui/MADTours/AvailabilityBookingWidget/AvailabilityBookingWidget.jsx';
// --- NEW: Import the AvailabilityIndicatorWidget ---
import AvailabilityIndicatorWidget from '../ui/MADTours/AvailabilityIndicatorWidget/AvailabilityIndicatorWidget.jsx';


// --- Component List with 'type' and clean labels ---
const components = [
  // Pages
  { id: 'TourCollectionPage', label: 'Tour Collection Page', type: 'page' },
  { id: 'TourDetailPage', label: 'Tour Detail Page', type: 'page' },
  // Widgets
  { id: 'AvailabilityWidget', label: 'Availability Widget', type: 'widget' },
  { id: 'FeaturedTourWidget', label: 'Featured Tour Widget', type: 'widget' },
  { id: 'BookingCalendar', label: 'Booking Calendar Widget', type: 'widget' },
  { id: 'AvailabilityBookingWidget', label: 'Combined "Super" Widget', type: 'widget' },
  // --- NEW: Add new widget to the list ---
  { id: 'AvailabilityIndicatorWidget', label: 'Availability Indicator', type: 'widget' },
];

// --- NEW: Filter components into Pages and Widgets ---
const pageComponents = [...components]
  .filter((c) => c.type === 'page')
  .sort((a, b) => a.label.localeCompare(b.label));

const widgetComponents = [...components]
  .filter((c) => c.type === 'widget')
  .sort((a, b) => a.label.localeCompare(b.label));

const PrototypeShowcase = () => {
  const [activeComponentId, setActiveComponentId] = useState(pageComponents[0].id);
  
  // --- NEW: State to hold dynamic widget container style ---
  const [widgetContainerStyle, setWidgetContainerStyle] = useState({
    maxWidth: '100%',
  });

  // Find the config for the active component to check its type
  const activeComponentConfig = components.find(
    (c) => c.id === activeComponentId
  );
  const componentType = activeComponentConfig?.type || 'page';

  // --- NEW: Handle component selection ---
  const handleSelectComponent = (id, type) => {
    setActiveComponentId(id);
    // --- MODIFICATION: Removed style reset ---
    // The style will now persist when switching between pages and widgets
  };

  const renderActiveComponent = () => {
    switch (activeComponentId) {
      // Pages
      case 'TourCollectionPage':
        return <TourCollectionPage />;
      case 'TourDetailPage':
        return <TourDetailPage id={3} />;
      // Widgets
      case 'AvailabilityWidget':
        return <AvailabilityWidget />;
      case 'FeaturedTourWidget':
        return <FeaturedTourWidget tourId={3} />;
      case 'BookingCalendar':
        return (
          <BookingCalendar
            tourId={3}
            basePrice="50.00"
            defaultDate={null}
            defaultGuests={1}
          />
        );
      case 'AvailabilityBookingWidget':
        return <AvailabilityBookingWidget />;
      // --- NEW: Add case for the new widget ---
      case 'AvailabilityIndicatorWidget':
        return <AvailabilityIndicatorWidget />;
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
          MADTours Module Prototypes
        </p>
        
        {/* --- NEW: Pages List --- */}
        <h3 className={styles.listHeading}>Pages (Modules)</h3>
        <ul className={styles.menuList}>
          {pageComponents.map((component) => (
            <li key={component.id}>
              <button
                className={`${styles.menuButton} ${
                  activeComponentId === component.id ? styles.active : ''
                }`}
                onClick={() => handleSelectComponent(component.id, component.type)}
              >
                {component.label}
              </button>
            </li>
          ))}
        </ul>

        {/* --- NEW: Widgets List --- */}
        <h3 className={styles.listHeading}>Widgets (UI Components)</h3>
        <ul className={styles.menuList}>
          {widgetComponents.map((component) => (
            <li key={component.id}>
              <button
                className={`${styles.menuButton} ${
                  activeComponentId === component.id ? styles.active : ''
                }`}
                onClick={() => handleSelectComponent(component.id, component.type)}
              >
                {component.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* --- Main Content Sandbox --- */}
      <main className={styles.content}>
        {/* --- MODIFICATION: Conditionally render controls --- */}
        {/* The controls are now always visible */}
        <WidgetControls onSetStyle={setWidgetContainerStyle} />

        <div
          className={styles.sandbox}
          // --- NEW: Apply dynamic style ---
          style={widgetContainerStyle}
        >
          {renderActiveComponent()}
        </div>
      </main>
    </div>
  );
};

export default PrototypeShowcase;