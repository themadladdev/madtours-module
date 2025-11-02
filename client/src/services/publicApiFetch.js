// client/src/services/publicApiFetch.js
// This is a minimal fetch wrapper, as required by tourBookingService.js.

// A minimal fetch wrapper for public routes
const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error("Missing required environment variable: VITE_API_URL");
}

const publicApiFetch = async (endpoint, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  const config = {
    ...options,
    headers
  };
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || response.statusText);
    }
    
    if (response.status === 204) return null; // No Content
    return await response.json();

  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

export default publicApiFetch;