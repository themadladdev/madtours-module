// client/src/contexts/FeatureContext.jsx
// This is a temporary prototype stub that hardcodes the madtours feature to true.

import React, { createContext, useContext } from 'react';

const FeatureContext = createContext();

export const useFeatures = () => useContext(FeatureContext);

export const FeatureProvider = ({ children }) => {
  
  // PROTOTYPE STUB: Hardcode the feature flag to true
  const features = {
    madtours: true,
  };

  const isFeatureEnabled = (key) => !!features[key];

  return (
    <FeatureContext.Provider value={{ features, isFeatureEnabled }}>
      {children}
    </FeatureContext.Provider>
  );
};