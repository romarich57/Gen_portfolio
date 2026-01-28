/**
 * API base configuration for frontend requests.
 * Preconditions: VITE_API_BASE_URL is set for HTTPS dev.
 * Postconditions: exported base URL is safe for concatenation.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.toString() ?? 'https://localhost:4000';
