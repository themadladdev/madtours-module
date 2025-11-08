// client/src/adminPortal/AdminDashboard.jsx
import React, { useState, useEffect, Suspense, lazy } from 'react';
import sharedStyles from '../MADLibrary/admin/styles/adminshared.module.css';

// Lazy load MADTours admin components
const MADTourManagement = lazy(() => import('./MADTourManagement/MADTourManagement.jsx'));
const ManifestView = lazy(() => import('./MADTourManagement/Manifest/ManifestView.jsx'));

function PageLoader() {
  return (
    <div className={sharedStyles.loadingContainer} style={{ minHeight: '100vh' }}>
      <div className={sharedStyles.spinner}></div>
      <span>Loading...</span>
    </div>
  );
}

/**
 * This component acts as the central router for the *entire* MADTours admin module.
 * The main VanillaProject admin sidebar will load this component for any route
 * starting with '/admin/tours'. This component then decides which 
 * specific tour admin page to render.
 */
const AdminDashboard = () => {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onLocationChange = () => {
      setPath(window.location.pathname);
      window.scrollTo(0, 0); 
    };

    // Listen for custom navigation events
    window.addEventListener('route-change', onLocationChange);
    // Listen for browser back/forward
    window.addEventListener('popstate', onLocationChange);

    return () => {
      window.removeEventListener('route-change', onLocationChange);
      window.removeEventListener('popstate', onLocationChange);
    };
  }, []);

  const renderComponent = () => {
    // --- MADTours Admin Routes ---

    // Match for the main management wrapper
    // /admin/tours, /admin/tours/dashboard, /admin/tours/calendar, /admin/tours/bookings
    // All render the main wrapper, which handles its own internal tabs.
    if (
      path === '/admin/tours' ||
      path === '/admin/tours/dashboard' ||
      path === '/admin/tours/calendar' ||
      path === '/admin/tours/bookings'
    ) {
      return <MADTourManagement />;
    }

    // Match for the standalone Manifest view
    const manifestMatch = path.match(/^\/admin\/tours\/manifest\/(\d+)$/);
    if (manifestMatch) {
      const id = manifestMatch[1];
      return <ManifestView instanceId={id} />;
    }
    
    // Fallback for any other /admin/tours path
    return <MADTourManagement />;
  };

  return (
    <Suspense fallback={<PageLoader />}>
      {renderComponent()}
    </Suspense>
  );
};

export default AdminDashboard;