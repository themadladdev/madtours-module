// client/src/services/adminApiFetch.js
// This is a minimal fetch wrapper for admin routes, as required by adminTourService.js. It does not include auth tokens, as we are using a stub.

// A minimal fetch wrapper for admin routes
const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error("Missing required environment variable: VITE_API_URL");
}

const adminApiFetch = async (endpoint, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  // NOTE: In the real VanillaProject, we would get a token 
  // from AdminAuthContext and add it to the Authorization header.
  // For this prototype, we rely on the server's auth stub.
  
  const config = {
    ...options,
    headers
  };
  
  try {
    // We assume admin routes are prefixed with /admin in the server routes
    // so we don't add it here.
    const response = await fetch(`${API_URL}${endpoint}`, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || response.statusText);
    }
    
    if (response.status === 204) return null; // No Content
    return await response.json();

  } catch (error) {
    console.error('Admin API request failed:', error);
    throw error;
  }
};

export default adminApiFetch;