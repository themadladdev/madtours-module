// client/src/MADLibrary/admin/icons/VanillaProjectLogo.jsx
import React from 'react';

/**
 * This is a placeholder logo for the Vanilla Project.
 * @param {object} props - Standard React props
 * @param {string} props.size - The size (width and height) of the SVG (e.g., "100px")
 * @param {string} [props.className] - Optional additional class names
 */
const VanillaProjectLogo = ({ size, className }) => {
  return (
    <svg 
      width={size}
      height={size}
      className={className} 
      viewBox="0 0 100 100" 
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true" /* This is decorative */
    >
      <rect 
        x="5" 
        y="5" 
        width="90" 
        height="90" 
        rx="10" 
        stroke="var(--text)" 
        strokeWidth="4" 
        fill="var(--grey-100)" 
      />
      <text 
        x="50%" 
        y="50%" 
        dy=".3em" 
        textAnchor="middle" 
        fill="var(--text)" 
        fontSize="50" 
        fontWeight="600"
      >
        M
      </text>
    </svg>
  );
};

export default VanillaProjectLogo;