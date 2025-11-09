// ==========================================
// client/src/adminPortal/MADTourManagement/BookingManager/BookingFilter.jsx
// ==========================================
import React from 'react';
import styles from './BookingFilter.module.css';
import sharedStyles from '../../../MADLibrary/admin/styles/adminshared.module.css';

const BookingFilter = ({
  activeQuickFilter,
  populatedQuickFilters,
  dateFilters,
  onDateFiltersChange,
  searchTerm,
  onSearchTermChange,
  isSearchOpen,
  onIsSearchOpenChange,
  onQuickFilterChange,
  onClearFilters
}) => {
  return (
    <>
      {/* --- Desktop Quick Filter Nav --- */}
      <div className={`${styles.quickFilterNav} ${styles.desktopNav}`}>
        {populatedQuickFilters.map(filter => (
          <button
            key={filter.id}
            className={`${styles.navButton} ${activeQuickFilter === filter.id ? styles.active : ''}`}
            onClick={() => onQuickFilterChange(filter.id)}
          >
            <span>{filter.label}</span>
            {filter.badge > 0 && (
              <span className={
                filter.badgeType === 'destructive'
                  ? sharedStyles.notificationBadgeDestructive
                  : sharedStyles.notificationBadge
              }>
                {filter.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      
      {/* --- Mobile Quick Filter Select --- */}
      <div className={styles.mobileNav}>
        <select
          className={styles.mobileQuickFilter}
          value={activeQuickFilter}
          onChange={(e) => onQuickFilterChange(e.target.value)}
        >
          {populatedQuickFilters.map(filter => (
            <option key={filter.id} value={filter.id}>
              {filter.label} {filter.badge > 0 ? `(${filter.badge})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* --- Collapsible Filter Box --- */}
      <div className={sharedStyles.filterBox} style={{ marginBottom: '1.5rem', gap: '0' }}>
        
        <div className={styles.filterRow}>
          <div className={styles.filterItem}>
            <label htmlFor="filter-start-date">
              <span className={styles.desktopLabel}>Date </span>From:
            </label>
            <input
              id="filter-start-date"
              type="date"
              className={sharedStyles.input}
              value={dateFilters.startDate}
              onChange={(e) => onDateFiltersChange({ ...dateFilters, startDate: e.target.value })}
              onClick={(e) => e.target.showPicker()}
              onMouseDown={(e) => e.preventDefault()}
            />
          </div>
          <div className={styles.filterItem}>
            <label htmlFor="filter-end-date">
              <span className={styles.desktopLabel}>Date </span>To:
            </label>
            <input
              id="filter-end-date"
              type="date"
              className={sharedStyles.input}
              value={dateFilters.endDate}
              onChange={(e) => onDateFiltersChange({ ...dateFilters, endDate: e.target.value })}
              onClick={(e) => e.target.showPicker()}
              onMouseDown={(e) => e.preventDefault()}
            />
          </div>
          
          <div className={styles.toggleItem}>
            <button 
              className={styles.advancedSearchToggle} 
              onClick={() => onIsSearchOpenChange(!isSearchOpen)}
              title={isSearchOpen ? 'Hide Search' : 'Show Advanced Search'}
            >
              {isSearchOpen ? '▲' : '▼'}
            </button>
          </div>
        </div>
        
        <div className={`${styles.collapsibleSearch} ${isSearchOpen ? styles.open : ''}`}>
          <div className={styles.searchActionRow}>
            <div className={styles.filterItem}>
              <label htmlFor="search-term">Search:</label>
              <input
                id="search-term"
                type="text"
                className={sharedStyles.input}
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                placeholder="Name or Booking Ref..."
              />
            </div>
            <div className={styles.filterPanelActions}>
              <button 
                className={sharedStyles.secondaryButton}
                onClick={onClearFilters}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BookingFilter;