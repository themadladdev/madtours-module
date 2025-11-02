// server/src/middleware/adminAuth.js (Prototype Stub)
// This is a temporary prototype stub. It bypasses authentication to allow you to test your admin routes.

// PROTOTYPE STUB
// This is not secure and must be replaced by the real
// adminAuth.js from VanillaProject during integration.

export const authenticateAdmin = (req, res, next) => {
  console.warn('!!! PROTOTYPE WARNING: Admin authentication is currently bypassed. !!!');
  // For testing, create a dummy user object
  req.user = { id: 1, email: 'prototype_admin@test.com', role: 'admin' };
  next();
};

export const authenticateDeveloper = (req, res, next) => {
  console.warn('!!! PROTOTYPE WARNING: Developer authentication is currently bypassed. !!!');
  req.user = { id: 1, email: 'prototype_dev@test.com', role: 'developer' };
  next();
};