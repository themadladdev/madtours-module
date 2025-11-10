// client/src/modules/PaymentResult/PaymentResult.jsx
import React, { useState, useEffect } from 'react';
import styles from './PaymentResult.module.css';

// --- This is the "Plugin" system ---
// We map a 'handler' name (from the URL) to the specific bolt-on's logic file.
const HANDLER_REGISTRY = {
  // --- [FIX] ---
  // Corrected the relative path.
  // It should go up one level (to /modules) and then into MADTours.
  'madtours-verify': () => import('../MADTours/handlers/verifyStripePayment.js')
  // --- [END FIX] ---
  // Future bolt-ons like 'madshop-verify' would be added here
};
// ------------------------------------


const PaymentResult = () => {
  const [result, setResult] = useState({
    status: 'loading',
    title: 'Verifying Payment...',
    message: 'Please wait while we confirm your transaction.'
  });

  // This is a placeholder for the handleNavigate function
  // On the real site, this would be imported
  const handleNavigate = (event, path) => {
    event.preventDefault();
    // This is just a simulation for the prototype
    // The real function would be imported
    console.log(`[PaymentResult] Navigating to ${path}`);
    window.location.href = path; // Simple redirect for now
  };

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const handlerName = params.get('handler');
        
        if (!handlerName) {
          throw new Error('No "handler" parameter found in URL.');
        }

        const handlerImport = HANDLER_REGISTRY[handlerName];
        if (!handlerImport) {
          throw new Error(`Unknown handler: "${handlerName}"`);
        }
        
        // Dynamically import the bolt-on's logic
        const handlerModule = await handlerImport();
        
        // All handler modules must export a function that matches
        // the one we're expecting (e.g., 'handleStripeVerification')
        // We'll assume the primary export is the correct function
        const verificationFn = Object.values(handlerModule)[0];
        
        if (typeof verificationFn !== 'function') {
           throw new Error(`Handler for "${handlerName}" is not a valid function.`);
        }
        
        // Run the bolt-on's verification logic
        const verificationResult = await verificationFn(params);
        setResult(verificationResult);

      } catch (err) {
        setResult({
          status: 'error',
          title: 'Verification Error',
          message: err.message
        });
      }
    };

    verifyPayment();
  }, []); // Run only once on page load

  return (
    <div className={styles.handlerContainer}>
      <div className={`${styles.resultBox} ${styles[result.status]}`}>
        {result.status === 'loading' && (
          <div className={styles.spinner}></div>
        )}
        {result.status === 'success' && (
          <div className={styles.icon}>&#10004;</div> // Checkmark
        )}
        {result.status === 'error' && (
          <div className={styles.icon}>&#10006;</div> // X-mark
        )}
        
        <h2 className={styles.title}>{result.title}</h2>
        <p className={styles.message}>{result.message}</p>
        
        {(result.status === 'success' || result.status === 'error') && (
          <a
            href="/"
            onClick={(e) => handleNavigate(e, '/')}
            className={styles.homeButton}
          >
            Back to Home
          </a>
        )}
      </div>
    </div>
  );
};

export default PaymentResult;