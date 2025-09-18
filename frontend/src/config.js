// src/config.js
// Base API URL comes from environment variable injected at build time (REACT_APP_API_URL).
// Fallback to localhost for development.
export const API_URL =
  (process.env.REACT_APP_API_URL?.replace(/\/+$/, '') || 'http://127.0.0.1:8000') + '/api/3day/';
