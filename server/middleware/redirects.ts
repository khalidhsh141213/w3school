import { NextFunction, Request, Response } from "express";

/**
 * Middleware to handle redirects for legacy routes
 */
export const handleRedirects = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Check for settings#support URL pattern
  if (req.path === "/settings" && req.url.includes("#support")) {
    return res.redirect(301, "/support");
  }

  // Add other redirects as needed

  next();
};
