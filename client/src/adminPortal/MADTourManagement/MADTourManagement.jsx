// client/src/adminPortal/MADTourManagement/MADTourManagement.jsx
import React, { useState, useEffect } from 'react';
import styles from './MADTourManagement.module.css';
import sharedStyles from '../adminshared.module.css';
// --- FIX: Corrected import path from 3 dots to 2 ---
import { getAllBookings } from '../../services/admin/adminBookingService.js';

// Import sub-page components
import TourDashboard from './Dashboard/TourDashboard.jsx';
import BookingManager from './BookingManager/BookingManager.jsx';
import InstanceManager from './InstanceManager/InstanceManager.jsx';
import TourManager from './TourManager/TourManager.jsx';

// Placeholder Icon
const IconPlaceholder = () => <span style={{ marginRight: '8px' }}>•</span>;


const MADTourManagement = () => {
    const [activeSubTab, setActiveSubTab] = useState('dashboard');
    const [resolutionCount, setResolutionCount] = useState(0); 

    // Read the path to set the initial tab
    useEffect(() => {
        const path = window.location.pathname;
        if (path.includes('/operations')) {
            setActiveSubTab('operations');
        } else if (path.includes('/bookings')) {
            setActiveSubTab('bookings');
        } else if (path.includes('/manage')) {
            setActiveSubTab('tours');
        } else {
            setActiveSubTab('dashboard');
        }
        
        // Fetch count for the badge
        fetchResolutionCount();
    }, []);

    // Custom navigation handler
    const handleNavigate = (event, path, tabId) => {
        event.preventDefault();
        
        fetchResolutionCount();
        
        setActiveSubTab(tabId);
        window.history.pushState({}, '', path);
        const navigationEvent = new CustomEvent('route-change');
        window.dispatchEvent(navigationEvent);
    };

    const fetchResolutionCount = async () => {
        try {
            const data = await getAllBookings({ status: 'pending_triage' });
            setResolutionCount(data.length || 0);
        } catch (error) {
            console.error('Error fetching resolution count:', error);
            setResolutionCount(0);
        }
    };
    
    const subTabs = [
        { 
            id: 'dashboard', 
            label: 'Dashboard', 
            path: '/admin/tours/dashboard',
            icon: <IconPlaceholder />,
            component: <TourDashboard /> 
        },
        { 
            id: 'operations', 
            label: 'Operations Hub', 
            path: '/admin/tours/operations',
            icon: <IconPlaceholder />, 
            component: <InstanceManager />
        },
        { 
            id: 'bookings', 
            label: 'Bookings', 
            path: '/admin/tours/bookings',
            icon: <IconPlaceholder />,
            component: <BookingManager defaultResolutionCount={resolutionCount} />,
            badge: resolutionCount > 0 ? resolutionCount : null
        },
        { 
            id: 'tours', 
            label: 'Tours', 
            path: '/admin/tours/manage',
            icon: <IconPlaceholder />,
            component: <TourManager /> 
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
                            {tab.badge && (
                                <span className={styles.resolutionBadge}>{tab.badge}</span>
                            )}
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