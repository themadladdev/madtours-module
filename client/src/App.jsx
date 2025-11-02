// client/src/App.jsx
// This is the most important file. It implements our custom router and defines the routes for all public MADTours components.

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useFeatures } from './contexts/FeatureContext.jsx';

// --- Lazy Load All Page-Level Components ---
// Admin portal host
const AdminDashboard = lazy(() => import('./adminPortal/AdminDashboard.jsx'));

// Public MADTours pages
const BookingCalendar = lazy(() => import('./modules/MADTourBooking/BookingCalendar.jsx'));
const BookingForm = lazy(() => import('./modules/MADTourBooking/BookingForm.jsx'));
const BookingConfirmation = lazy(() => import('./modules/MADTourBooking/BookingConfirmation.jsx'));
const BookingLookup = lazy(() => import('./modules/MADTourBooking/BookingLookup.jsx'));

// A simple loading component
function PageLoader() {
  return <div style={{ padding: '2rem' }}>Loading page...</div>;
}

function App() {
  const [path, setPath] = useState(window.location.pathname);
  const { features } = useFeatures();

  // --- Custom Router Logic (from Universal_Custom_React_Router_Standard.md) ---
  useEffect(() => {
    const onLocationChange = () => {
      setPath(window.location.pathname);
      window.scrollTo(0, 0); 
    };

    window.addEventListener('route-change', onLocationChange);
    window.addEventListener('popstate', onLocationChange);

    return () => {
      window.removeEventListener('route-change', onLocationChange);
      window.removeEventListener('popstate', onLocationChange);
    };
  }, []);

  const renderComponent = () => {
    
    // --- Admin Route Catcher ---
    if (path.startsWith('/admin')) {
      return <AdminDashboard />;
    }

    // --- MADTours Public Routes ---
    if (features.madtours) {
      // The main booking page, which shows the Calendar/Form wrapper
      if (path === '/') {
        return <BookingPageWrapper />;
      }
      
      // The "find my booking" page
      if (path === '/booking/lookup') {
        return <BookingLookup />;
      }

      // The booking confirmation page, with a regex for the reference
      const confirmMatch = path.match(/^\/booking\/confirmation\/([A-Z0-9]+)$/);
      if (confirmMatch) {
        const reference = confirmMatch[1];
        return <BookingConfirmation bookingReference={reference} />;
      }
    }
        
    // --- 404 Catch-all ---
    return (
      <div style={{ padding: '2rem' }}>
        <h1>404 - Page Not Found</h1>
        <p>Go to <a href="/" onClick={(e) => {
            e.preventDefault();
            window.history.pushState({}, '', '/');
            window.dispatchEvent(new CustomEvent('route-change'));
          }}>Home</a></p>
      </div>
    );
  };

  return (
    <Suspense fallback={<PageLoader />}>
      {renderComponent()}
    </Suspense>
  );
}

// --- Wrapper for Booking Flow ---
// This component manages the state between the Calendar and Form
function BookingPageWrapper() {
  const [selection, setSelection] = useState(null);

  const handleNavigate = (event, path) => {
    event.preventDefault();
    window.history.pushState({}, '', path);
    const navigationEvent = new CustomEvent('route-change');
    window.dispatchEvent(navigationEvent);
  };

  if (selection) {
    return (
      <BookingForm 
        // === PROPS CORRECTED ===
        selection={selection}
        onBookingSuccess={(reference) => {
          // Navigate to confirmation page
          handleNavigate(new Event('click'), `/booking/confirmation/${reference}`);
        }}
        onBack={() => setSelection(null)}
        // === END CORRECTION ===
      />
    );
  }

  return <BookingCalendar onSelectTour={setSelection} />;
}

export default App;