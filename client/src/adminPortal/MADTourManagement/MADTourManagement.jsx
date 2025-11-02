// client/src/adminPortal/MADTourManagement/MADTourManagement.jsx
import React, { useState, useEffect } from 'react';
import styles from './MADTourManagement.module.css';
import sharedStyles from '../adminshared.module.css';

// Import sub-page components
import TourDashboard from './Dashboard/TourDashboard.jsx';
import BookingManager from './BookingManager/BookingManager.jsx';
import InstanceManager from './InstanceManager/InstanceManager.jsx';
import TourManager from './TourManager/TourManager.jsx'; // === NEW IMPORT ===

// Placeholder Icon
const IconPlaceholder = () => <span style={{ marginRight: '8px' }}>•</span>;


const MADTourManagement = () => {
    const [activeSubTab, setActiveSubTab] = useState('dashboard');

    // Read the path to set the initial tab
    useEffect(() => {
        const path = window.location.pathname;
        if (path.includes('/calendar')) {
            setActiveSubTab('calendar');
        } else if (path.includes('/bookings')) {
            setActiveSubTab('bookings');
        } else if (path.includes('/manage')) { // === NEW ROUTE ===
            setActiveSubTab('tours');
        } else {
            setActiveSubTab('dashboard');
        }
    }, []);

    // Custom navigation handler
    const handleNavigate = (event, path, tabId) => {
        event.preventDefault();
        setActiveSubTab(tabId);
        
        // Update browser URL without full reload
        window.history.pushState({}, '', path);
        
        // Dispatch custom event for our router
        const navigationEvent = new CustomEvent('route-change');
        window.dispatchEvent(navigationEvent);
    };

    const subTabs = [
        { 
            id: 'dashboard', 
            label: 'Dashboard', 
            path: '/admin/tours/dashboard',
            icon: <IconPlaceholder />,
            component: <TourDashboard /> 
        },
        // === NEW TAB ===
        { 
            id: 'tours', 
            label: 'Tours', 
            path: '/admin/tours/manage',
            icon: <IconPlaceholder />,
            component: <TourManager /> 
        },
        { 
            id: 'calendar', 
            label: 'Calendar', 
            path: '/admin/tours/calendar',
            icon: <IconPlaceholder />, 
            component: <InstanceManager />
        },
        { 
            id: 'bookings', 
            label: 'Bookings', 
            path: '/admin/tours/bookings',
            icon: <IconPlaceholder />,
            component: <BookingManager />
        },
    ];

    const renderSubComponent = () => {
        const activeTab = subTabs.find(tab => tab.id === activeSubTab);
        return activeTab ? activeTab.component : <p>Select a tab.</p>;
    };

    return (
        <div className={styles.tourContainer}>
             {/* --- Standardized Page Header --- */}
             <div className={styles.topHeaderBar}>
                 <div className={styles.headerInfo}>
                    <h2>Tour Management</h2>
                    <p className={sharedStyles.description}>
                        Manage tour schedules, view bookings, and see manifests.
                    </p>
                 </div>
             </div>
             
             {/* --- Sub Navigation Tabs --- */}
             <div className={styles.pageNavWrapper}>
                <div className={styles.subNavigation}>
                    {subTabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`${styles.navButton} ${activeSubTab === tab.id ? styles.active : ''}`}
                            onClick={(e) => handleNavigate(e, tab.path, tab.id)}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
             </div>

            {/* Content Area */}
            <div className={styles.contentArea}>
                 {renderSubComponent()}
            </div>
        </div>
    );
};

export default MADTourManagement;