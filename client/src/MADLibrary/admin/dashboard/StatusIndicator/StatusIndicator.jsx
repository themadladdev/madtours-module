// ==========================================
// client/src/MADLibrary/admin/dashboard/StatusIndicator/StatusIndicator.jsx
// ==========================================

import React from 'react';
import styles from './StatusIndicator.module.css';

const StatusIndicator = ({ variant = 'default', children }) => {
  // Determine the style class based on the variant prop
  const variantClass = styles[variant.toLowerCase()] || styles.default;

  return (
    <span className={styles.indicatorWrapper}>
      <span className={`${styles.indicatorDot} ${variantClass}`}></span>
      <span className={styles.indicatorText}>{children}</span>
    </span>
  );
};

export default StatusIndicator;