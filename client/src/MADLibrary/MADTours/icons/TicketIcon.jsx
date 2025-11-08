// ==========================================
// client/src/ui/MADLibrary/MADTours/icons/TicketIcon.jsx
// ==========================================

import React from 'react';
import styles from './Icon.module.css';

const TicketIcon = ({ size = 12 }) => {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="0"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        stroke="none"
        d="M20 12c0-1.1.9-2 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v4c1.1 0 2 .9 2 2s-.9 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2zm-2-6h-3v12h3V6z"
      />
    </svg>
  );
};

export default TicketIcon;