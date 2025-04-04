import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to check if the user is authenticated
 */
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  // Check if the user is authenticated
  if (req.isAuthenticated()) {
    return next();
  }
  
  // Return 401 Unauthorized if not authenticated
  return res.status(401).json({ success: false, error: 'Authentication required' });
};

/**
 * Middleware to check if the user is an admin
 */
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  // Check if the user is authenticated and is an admin
  if (req.isAuthenticated() && req.user && req.user.userRole === 'admin') {
    return next();
  }
  
  // If authenticated but not admin
  if (req.isAuthenticated()) {
    return res.status(403).json({ success: false, error: 'Admin privileges required' });
  }
  
  // If not authenticated
  return res.status(401).json({ success: false, error: 'Authentication required' });
};

// Export other auth functions from server/middleware/auth.ts
export { verifyToken, verifyAuth, verifyAdmin, logAdminAccess, adminRateLimit } from '../auth-token.js';