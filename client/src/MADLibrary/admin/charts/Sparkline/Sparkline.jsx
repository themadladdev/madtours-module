// ==========================================
// client/src/MADLibrary/admin/charts/Sparkline/Sparkline.jsx
// ==========================================

import React from 'react';
import styles from './Sparkline.module.css';

const Sparkline = ({
  data = [],
  width = 100,
  height = 20,
  strokeWidth = 1.5
}) => {
  if (!data || data.length < 2) {
    // Cannot draw a line with less than 2 points
    return (
      <svg width={width} height={height} className={styles.sparklineSvg}></svg>
    );
  }

  // Find min and max to normalize data
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = (max - min) || 1; // Prevent division by zero if all values are the same

  // Calculate points
  const points = data.map((d, i) => {
    // X coordinate: evenly spaced
    const x = (i / (data.length - 1)) * width;
    
    // Y coordinate: normalized, scaled, and inverted (0 is top in SVG)
    const normalizedY = (d - min) / range;
    const y = (1 - normalizedY) * (height - strokeWidth * 2) + strokeWidth;
    
    return `${x},${y}`;
  });

  // Create the "d" attribute for the SVG path
  const pathData = `M ${points[0]} L ${points.slice(1).join(' ')}`;

  return (
    <svg
      width={width}
      height={height}
      className={styles.sparklineSvg}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <path
        className={styles.sparklinePath}
        d={pathData}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
};

export default Sparkline;