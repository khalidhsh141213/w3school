#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(__dirname, "server");
const authFile = path.join(serverDir, "middleware", "auth.ts");

// Read the file
const content = fs.readFileSync(authFile, "utf8");

// Replace @shared import with relative path
const updatedContent = content.replace(
  "import { users } from '@shared/schema';",
  "import { users } from '../../shared/schema';",
);

// Write back the file
fs.writeFileSync(authFile, updatedContent);

console.log("Fixed import in auth.ts");

// Create a temporary auth.js for testing
const authJSContent = `
// Temporary auth.js file for testing
const { users } = require('../../shared/schema');

function verifyToken(req, res, next) {
  // Simplified for testing
  next();
}

function verifyAuth(req, res, next) {
  // Simplified for testing
  if (req.headers.authorization) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

module.exports = { verifyToken, verifyAuth };
`;

fs.writeFileSync(path.join(serverDir, "middleware", "auth.js"), authJSContent);
console.log("Created temporary auth.js for testing");
