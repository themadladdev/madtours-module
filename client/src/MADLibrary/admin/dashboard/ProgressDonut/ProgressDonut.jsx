// ==========================================
// client/src/ui/MADLibrary/MADTours/dashboard/ProgressDonut/ProgressDonut.jsx
// ==========================================

import React from 'react';
import styles from './ProgressDonut.module.css';

const ProgressDonut = ({ value = 0, max = 1, size = 36 }) => {
  const strokeWidth = 4;
  const radius = (size / 2) - (strokeWidth * 2);
  const circumference = radius * 2 * Math.PI;
  
  // Handle 0 max to prevent division by zero
  const safeMax = max > 0 ? max : 1;
  const safeValue = value > safeMax ? safeMax : value;
  
  const offset = circumference - (safeValue / safeMax) * circumference;

  return (
    <div className={styles.donutWrapper} style={{ width: size, height: size }}>
      <svg
        className={styles.donutSvg}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Track (Background) */}
        <circle
          className={styles.donutTrack}
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress (Fill) */}
        <circle
          className={styles.donutProgress}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      {/* Text in the middle */}
      <span className={styles.donutText}>
        {value}
      </span>
    </div>
  );
};

export default ProgressDonut;