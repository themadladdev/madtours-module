// ==========================================
// UPDATED FILE
// client/src/adminPortal/MADTourManagement/MADTourManagement.jsx
// ==========================================

import React, { useState, useEffect } from 'react';
import styles from './MADTourManagement.module.css';
import sharedStyles from '../../MADLibrary/admin/styles/adminshared.module.css';
import { getAllBookings } from '../../services/admin/adminBookingService.js';

// Import sub-page components
import TourDashboard from './Dashboard/TourDashboard.jsx';
import InstanceManager from './InstanceManager/InstanceManager.jsx';
import BookingManager from './BookingManager/BookingManager.jsx';
import TourManager from './TourManager/TourManager.jsx';
import TicketManager from './TicketManager/TicketManager.jsx';
import Statistics from './Statistics/Statistics.jsx';

// --- [NEW] Import the modal ---
import ManualBookingModal from './BookingManager/ManualBookingModal.jsx';


// Placeholder Icon
const IconPlaceholder = () => <span style={{ marginRight: '8px' }}>•</span>;


const MADTourManagement = () => {
    const [activeSubTab, setActiveSubTab] = useState('dashboard');
    const [resolutionCount, setResolutionCount] = useState(0); 
    
    // --- [NEW] State for the manual booking modal ---
    const [isManualBookingModalOpen, setIsManualBookingModalOpen] = useState(false);

    // --- [MODIFIED] This effect now handles initial load AND navigation ---
    useEffect(() => {
        const updateActiveTab = () => {
            const path = window.location.pathname;
            if (path.includes('/operations')) {
                setActiveSubTab('operations');
            } else if (path.includes('/bookings')) {
                setActiveSubTab('bookings');
            } else if (path.includes('/manage')) {
                setActiveSubTab('tours');
            } else if (path.includes('/tickets')) {
                setActiveSubTab('tickets');
            } else if (path.includes('/statistics')) { 
                setActiveSubTab('statistics');
            } else {
                setActiveSubTab('dashboard'); // Default
            }
        };

        // Run once on initial load
        updateActiveTab();
        fetchResolutionCount();
        
        // Add event listener to re-run when our custom router navigates
        window.addEventListener('route-change', updateActiveTab);

        // Cleanup listener
        return () => {
            window.removeEventListener('route-change', updateActiveTab);
        };
    }, []); // Empty array is correct, as we are managing the listener manually

    // Custom navigation handler for *this component's* tabs
    const handleNavigate = (event, path, tabId) => {
        // Check if event is from a DOM click or select onChange
        const isSelectEvent = event.target.tagName === 'SELECT';
        
        if (!isSelectEvent) {
            event.preventDefault();
        }
        
        // Refresh count on any navigation
        fetchResolutionCount();
        
        // This component doesn't need to set its own active tab here,
        // because the 'route-change' event listener above will handle it.
        // setActiveSubTab(tabId); // <-- This is now handled by the useEffect
        
        window.history.pushState({}, '', path);
        const navigationEvent = new CustomEvent('route-change');
        window.dispatchEvent(navigationEvent);
    };
    
    const handleMobileNavChange = (event) => {
        const selectedTabId = event.target.value;
        const selectedTab = subTabs.find(tab => tab.id === selectedTabId);
        if (selectedTab) {
            handleNavigate(event, selectedTab.path, selectedTab.id);
        }
    };

    /**
     * Fetches the count of ALL "actionable items" for the admin.
     */
    const fetchResolutionCount = async () => {
        try {
            const data = await getAllBookings({ 
              special_filter: 'action_required' 
            });
            
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
            // --- [NEW] Pass navigation handler to dashboard ---
            component: <TourDashboard onNavigate={handleNavigate} /> 
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
            component: <BookingManager defaultActionCount={resolutionCount} />,
            badge: resolutionCount > 0 ? resolutionCount : null
        },
        { 
            id: 'tours', 
            label: 'Tours', 
            path: '/admin/tours/manage',
            icon: <IconPlaceholder />,
            component: <TourManager /> 
        },
        { 
            id: 'tickets', 
            label: 'Ticket Library', 
            path: '/admin/tours/tickets',
            icon: <IconPlaceholder />,
            component: <TicketManager /> 
        },
        { 
            id: 'statistics', 
            label: 'Statistics', 
            path: '/admin/tours/statistics',
            icon: <IconPlaceholder />,
            component: <Statistics /> 
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
                 {/* --- Global Action Button --- */}
                 <div className={styles.headerActions}>
                    <button 
                        className={sharedStyles.primaryButton}
                        onClick={() => setIsManualBookingModalOpen(true)}
                    >
                        Create New Booking
                    </button>
                 </div>
             </div>
             
             {/* --- Sub Navigation Tabs --- */}
             <div className={styles.pageNavWrapper}>
                <div className={styles.desktopSubNav}>
                    {subTabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`${styles.navButton} ${activeSubTab === tab.id ? styles.active : ''}`}
                            onClick={(e) => handleNavigate(e, tab.path, tab.id)}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                            {tab.badge && (
                                <span className={sharedStyles.notificationBadgeDestructive}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                
                <div className={styles.mobileSubNav}>
                    <select
                        className={styles.mobileQuickFilter}
                        value={activeSubTab}
                        onChange={handleMobileNavChange}
                    >
                        {subTabs.map(tab => (
                            <option key={tab.id} value={tab.id}>
                                {tab.label} {tab.badge ? `(${tab.badge})` : ''}
                            </option>
                        ))}
                    </select>
                </div>
             </div>

            {/* Content Area */}
            <div className={styles.contentArea}>
                 {renderSubComponent()}
            </div>

            {/* --- Render the modal --- */}
            <ManualBookingModal
                isOpen={isManualBookingModalOpen}
                onClose={() => setIsManualBookingModalOpen(false)}
            />
        </div>
    );
};

export default MADTourManagement;