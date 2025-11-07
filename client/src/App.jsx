// client/src/App.jsx
// This file implements our custom router and defines the routes for the NEW prototype.

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useFeatures } from './contexts/FeatureContext.jsx';

// --- Import Controls & Styles ---
import WidgetControls from './prototypeshowcase/WidgetControls.jsx';
// We borrow the sandbox style from the showcase for our wrapper
import sandboxStyles from './prototypeshowcase/PrototypeShowcase.module.css';

// --- Lazy Load All Page-Level Components ---

// Admin portal host
const AdminDashboard = lazy(() => import('./adminPortal/AdminDashboard.jsx'));

// --- PROTOTYPE SHOWCASE ---
const PrototypeShowcase = lazy(() => import('./prototypeshowcase/PrototypeShowcase.jsx'));

// --- NEW MADTours Prototype Components ---
const TourCollectionPage = lazy(() => import('./modules/MADTours/TourCollectionPage/TourCollectionPage.jsx'));
const TourDetailPage = lazy(() => import('./modules/MADTours/TourDetailPage/TourDetailPage.jsx'));
// --- NEW: Add the BookingPage ---
const BookingPage = lazy(() => import('./modules/MADTours/BookingPage/BookingPage.old.jsx'));


// A simple loading component
function PageLoader() {
  return <div style={{ padding: '2rem' }}>Loading page...</div>;
}

function App() {
  const [path, setPath] = useState(window.location.pathname);
  const { features } = useFeatures();

  // --- NEW: State for responsive controls ---
  const [widgetContainerStyle, setWidgetContainerStyle] = useState({
    maxWidth: '100%',
  });

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

  // --- Custom Navigation (Helper for 404) ---
  const handleNavigate = (event, path) => {
    event.preventDefault();
    window.history.pushState({}, '', path);
    window.dispatchEvent(new CustomEvent('route-change'));
  };

  const renderComponent = () => {
    
    // --- Admin Route Catcher ---
    if (path.startsWith('/admin')) {
      return <AdminDashboard />;
    }

    // --- PROTOTYPE SHOWCASE ---
    if (path === '/home') {
      return <PrototypeShowcase />;
    }

    // --- MADTours Public Routes ---
    if (features.madtours) {
      
      // --- NEW: Routes for Prototype Showcase ---
      
      // Point the root to the showcase
      if (path === '/') {
        return <PrototypeShowcase />;
      }
      
      // The main collection page
      if (path === '/tours') {
        return <TourCollectionPage />;
      }
      
      // --- NEW: Add the route for the booking page ---
      if (path === '/tours/book') {
        return <BookingPage />;
      }

      // The tour detail page (captures /tours/1, /tours/2, etc.)
      const detailMatch = path.match(/^\/tours\/(\d+)$/);
      if (detailMatch) {
        const id = detailMatch[1];
        return <TourDetailPage id={id} />;
      }
    }
        
    // --- 404 Catch-all ---
    return (
      <div style={{ padding: '2rem' }}>
        <h1>404 - Page Not Found</h1>
        <p>Go to <a href="/home" onClick={(e) => handleNavigate(e, '/home')}>
          Prototype Showcase
        </a></p>
      </div>
    );
  };

  // --- BUG FIX: Check for /home AND / path ---
  // These are the two paths that render the showcase, which has its own controls.
  const isShowcasePage = (path === '/home' || path === '/');

  return (
    <Suspense fallback={<PageLoader />}>
      {isShowcasePage ? (
        // Just render the component, it has its own controls
        renderComponent()
      ) : (
        // Render all other pages with the global controls
        <div style={{ padding: '2rem' }}>
          <WidgetControls onSetStyle={setWidgetContainerStyle} />
          <div
            className={sandboxStyles.sandbox}
            style={widgetContainerStyle}
          >
            {renderComponent()}
          </div>
        </div>
      )}
    </Suspense>
  );
}

export default App;