// client/src/prototypeshowcase/WidgetControls.jsx
import React, { useState } from 'react';
import styles from './WidgetControls.module.css';

const PRESET_STYLES = {
  fluid: { maxWidth: '100%', borderStyle: 'dashed', boxShadow: 'none' },
  tablet: {
    maxWidth: '870px',
    borderStyle: 'solid',
    boxShadow: '0 0 15px var(--grey-200)',
  },
  smartphone: {
    maxWidth: '360px',
    borderStyle: 'solid',
    boxShadow: '0 0 15px var(--grey-200)',
  },
  // FIXED: Renamed from 'mobiles' to 'mobileS' to match your button text,
  // or you can change button text to 'Mobiles (320px)'
  mobileS: {
    maxWidth: '320px',
    borderStyle: 'solid',
    boxShadow: '0 0 15px var(--grey-200)',
  },
};

const WidgetControls = ({ onSetStyle }) => {
  const [activePreset, setActivePreset] = useState('fluid');

  const handlePresetClick = (presetKey) => {
    setActivePreset(presetKey);
    onSetStyle(PRESET_STYLES[presetKey]);
  };

  return (
    <div className={styles.controlsContainer}>
      <span className={styles.controlsLabel}>Container Size:</span>
      <div className={styles.buttonGroup}>
        <button
          className={`${styles.controlButton} ${
            activePreset === 'fluid' ? styles.active : ''
          }`}
          onClick={() => handlePresetClick('fluid')}
        >
          Fluid (100%)
        </button>
        <button
          className={`${styles.controlButton} ${
            activePreset === 'tablet' ? styles.active : ''
          }`}
          onClick={() => handlePresetClick('tablet')}
        >
          Tablet (870px)
        </button>
        <button
          // FIXED: Check for 'smartphone'
          className={`${styles.controlButton} ${
            activePreset === 'smartphone' ? styles.active : ''
          }`}
          // FIXED: Pass 'smartphone'
          onClick={() => handlePresetClick('smartphone')}
        >
          Smartphone (360px)
        </button>
        <button
          // FIXED: Check for 'mobileS'
          className={`${styles.controlButton} ${
            activePreset === 'mobileS' ? styles.active : ''
          }`}
          // FIXED: Pass 'mobileS'
          onClick={() => handlePresetClick('mobileS')}
        >
          MobileS (320px)
        </button>
      </div>
    </div>
  );
};

export default WidgetControls;