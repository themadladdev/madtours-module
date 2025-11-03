// client/src/prototypeshowcase/WidgetControls.jsx
import React, { useState } from 'react';
import styles from './WidgetControls.module.css';

const PRESET_STYLES = {
  fluid: { maxWidth: '100%', borderStyle: 'dashed', boxShadow: 'none' },
  sidebar: {
    maxWidth: '400px',
    borderStyle: 'solid',
    boxShadow: '0 0 15px var(--grey-200)',
  },
  small: {
    maxWidth: '300px',
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
            activePreset === 'sidebar' ? styles.active : ''
          }`}
          onClick={() => handlePresetClick('sidebar')}
        >
          Sidebar (400px)
        </button>
        <button
          className={`${styles.controlButton} ${
            activePreset === 'small' ? styles.active : ''
          }`}
          onClick={() => handlePresetClick('small')}
        >
          Small (300px)
        </button>
      </div>
    </div>
  );
};

export default WidgetControls;