declare const __SOURCE_BACKEND_URL__: string | undefined;

const configuredBackend =
  typeof __SOURCE_BACKEND_URL__ !== "undefined"
    ? __SOURCE_BACKEND_URL__
    : undefined;

export const BACKEND_URL = (
  configuredBackend || import.meta.env?.VITE_BACKEND_URL || "http://localhost:3001"
).replace(/\/$/, "");
