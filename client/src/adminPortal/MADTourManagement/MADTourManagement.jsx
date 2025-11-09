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

    // Read the path to set the initial tab
    useEffect(() => {
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
        
        // Fetch count for the badge
        fetchResolutionCount();
    }, []);

    // Custom navigation handler
    const handleNavigate = (event, path, tabId) => {
        // Check if event is from a DOM click or select onChange
        const isSelectEvent = event.target.tagName === 'SELECT';
        
        if (!isSelectEvent) {
            event.preventDefault();
        }
        
        // Refresh count on any navigation
        fetchResolutionCount();
        
        setActiveSubTab(tabId);
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
     * --- [REFACTORED] ---
     * Fetches the count of ALL "actionable items" for the admin.
     * This includes Triage, Failed Refunds, Stuck Hostage, and Missed Payments.
     */
    const fetchResolutionCount = async () => {
        try {
            // --- [FIX] Use the new special_filter to get the *true* count ---
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
            // --- [FIX] Pass the true count down ---
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
                 {/* --- [NEW] Global Action Button --- */}
                 <div className={styles.headerActions}>
                    <button 
                        className={sharedStyles.primaryButton}
                        // --- [NEW] Wire up the modal ---
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
                            {/* --- [FIX] Using sharedStyles now --- */}
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

            {/* --- [NEW] Render the modal --- */}
            {/* This entry point passes no initial props, so the form is blank */}
            <ManualBookingModal
                isOpen={isManualBookingModalOpen}
                onClose={() => setIsManualBookingModalOpen(false)}
            />
        </div>
    );
};

export default MADTourManagement;