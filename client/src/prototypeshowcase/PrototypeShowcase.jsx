// client/src/prototypeshowcase/PrototypeShowcase.jsx
import React, { useState, useEffect } from 'react';
import styles from './PrototypeShowcase.module.css';

import WidgetControls from './WidgetControls.jsx';

// --- Page ("Module") Imports ---
import TourCollectionPage from '../modules/MADTours/TourCollectionPage/TourCollectionPage.jsx';
import TourDetailPage from '../modules/MADTours/TourDetailPage/TourDetailPage.jsx';

// --- Widget ("UI Component") Imports ---
import AvailabilityWidget from '../ui/MADTours/Widgets/AvailabilityWidget/AvailabilityWidget.jsx';
import FeaturedTourWidget from '../ui/MADTours/Widgets/FeaturedTourWidget/FeaturedTourWidget.jsx';
import BookingCalendarWidget from '../ui/MADTours/Widgets/BookingCalendarWidget/BookingCalendarWidget.jsx';
import AvailabilityBookingWidget from '../ui/MADTours/Widgets/AvailabilityBookingWidget/AvailabilityBookingWidget.jsx';
import AvailabilityIndicatorWidget from '../ui/MADTours/Widgets/AvailabilityIndicatorWidget/AvailabilityIndicatorWidget.jsx';
// --- NEW: Import the new TicketBookingWidget ---
import TicketBookingWidget from '../ui/MADTours/Widgets/TicketBookingWidget/TicketBookingWidget.jsx';

// --- Component List with 'type' and clean labels ---
const components = [
  // Pages
  { id: 'TourCollectionPage', 
    label: 'Tour Collection Page', 
    type: 'page' },

  { id: 'TourDetailPage', 
    label: 'Tour Detail Page', 
    type: 'page' },
    
  // Widgets
  { id: 'AvailabilityWidget', 
    label: 'Availability Widget', 
    type: 'widget' },

  { id: 'FeaturedTourWidget', 
    label: 'Featured Tour Widget', 
    type: 'widget' },

  { id: 'BookingCalendarWidget', 
    label: 'Booking Calendar Widget', 
    type: 'widget' },

  { id: 'AvailabilityBookingWidget',
    label: 'Combined "Super" Widget',
    type: 'widget' },
  { id: 'AvailabilityIndicatorWidget',
    label: 'Availability Indicator',
    type: 'widget' },
  
  { id: 'TicketBookingWidget', 
    label: 'Ticket Booking Widget', 
    type: 'widget' },
];

const pageComponents = [...components]
  .filter((c) => c.type === 'page')
  .sort((a, b) => a.label.localeCompare(b.label));

const widgetComponents = [...components]
  .filter((c) => c.type === 'widget')
  .sort((a, b) => a.label.localeCompare(b.label));

const PrototypeShowcase = () => {
  const [activeComponentId, setActiveComponentId] = useState(pageComponents[0].id);
  
  const [widgetContainerStyle, setWidgetContainerStyle] = useState({
    maxWidth: '100%',
  });

  // --- NEW: State to track mobile viewport ---
  const [isMobile, setIsMobile] = useState(
    window.matchMedia('(max-width: 768px)').matches
  );

  // --- NEW: Effect to listen for viewport changes ---
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    
    const handleResize = (event) => {
      setIsMobile(event.matches);
    };

    // Add listener
    mediaQuery.addEventListener('change', handleResize);

    // Clean up listener on unmount
    return () => {
      mediaQuery.removeEventListener('change', handleResize);
    };
  }, []);

  const activeComponentConfig = components.find(
    (c) => c.id === activeComponentId
  );
  const componentType = activeComponentConfig?.type || 'page';

  const handleSelectComponent = (id, type) => {
    setActiveComponentId(id);
    
    // We now apply a default "fluid" style ONLY when switching to a page
    // This allows the selected preset to persist when switching between widgets
    if (type === 'page') {
      setWidgetContainerStyle({
        maxWidth: '100%',
        borderStyle: 'dashed',
        boxShadow: 'none',
      });
    }
  };

  // --- NEW: Handler for the mobile <select> menu ---
  const handleMobileMenuChange = (event) => {
    const componentId = event.target.value;
    const selectedComponent = components.find((c) => c.id === componentId);
    if (selectedComponent) {
      handleSelectComponent(selectedComponent.id, selectedComponent.type);
    }
  };

  const renderActiveComponent = () => {
    switch (activeComponentId) {
      // Pages
      case 'TourCollectionPage':
        return <TourCollectionPage />;
      case 'TourDetailPage':
        return <TourDetailPage id={3} />; // STUB: Using tourId 3
      // Widgets
      case 'AvailabilityWidget':
        return <AvailabilityWidget />; // STUB: Needs tourId prop
      case 'FeaturedTourWidget':
        return <FeaturedTourWidget tourId={3} />;
      case 'BookingCalendarWidget':
        return (
          <BookingCalendarWidget
            tourId={3}
            basePrice="50.00" // STUB: This is now deprecated
            defaultDate={null}
            defaultGuests={1}
          />
        );
      case 'AvailabilityBookingWidget':
        return <AvailabilityBookingWidget />;
      case 'AvailabilityIndicatorWidget':
        return <AvailabilityIndicatorWidget />; // STUB: Needs tourId prop
      // --- NEW: Add case for the new widget ---
      case 'TicketBookingWidget':
        return <TicketBookingWidget />;
      default:
        return <p>Select a component to view.</p>;
    }
  };

  return (
    <div className={styles.showcaseContainer}>
      {/* --- Sidebar Menu (Desktop Only) --- */}
      {!isMobile && (
        <nav className={styles.sidebar}>
          <h2 className={styles.sidebarTitle}>Prototype Showcase</h2>
          <p className={styles.sidebarDescription}>
            MADTours Module Prototypes
          </p>
          
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
      )}

      {/* --- Main Content Sandbox --- */}
      <main className={styles.content}>
        
        {/* --- Mobile Menu Picker (Mobile Only) --- */}
        {isMobile && (
          <div className={styles.mobileMenuContainer}>
            <h2 className={styles.mobileMenuTitle}>MADTours Prototype</h2>
            <select
              className={styles.mobileMenuSelect}
              value={activeComponentId}
              onChange={handleMobileMenuChange}
            >
              <optgroup label="Pages (Modules)">
                {pageComponents.map((component) => (
                  <option key={component.id} value={component.id}>
                    {component.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Widgets (UI Components)">
                {widgetComponents.map((component) => (
                  <option key={component.id} value={component.id}>
                    {component.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        )}

        {/* --- Desktop Widget Controls (Desktop Only) --- */}
        {!isMobile && <WidgetControls onSetStyle={setWidgetContainerStyle} />}

        <div
          className={styles.sandbox}
          // --- MODIFICATION: Reset style prop on mobile ---
          style={!isMobile ? widgetContainerStyle : {}}
        >
          {renderActiveComponent()}
        </div>
      </main>
    </div>
  );
};

export default PrototypeShowcase;