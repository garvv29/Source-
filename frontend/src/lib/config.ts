const configuredBackend =
  typeof process !== "undefined" ? process.env.VITE_BACKEND_URL : undefined;

export const BACKEND_URL = (
  configuredBackend || import.meta.env?.VITE_BACKEND_URL || "http://localhost:3001"
).replace(/\/$/, "");
