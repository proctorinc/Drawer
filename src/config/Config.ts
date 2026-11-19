export const Config = {
  ENV: import.meta.env.VITE_ENV || 'production',
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  CLERK_PUBLISHABLE_KEY: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  APP_NAME: 'The Daily Doodle',
  CURSOR_SIZE: 20,
  CANVAS_WIDTH: 370,
  CANVAS_HEIGHT: 370,
  // Pixels per drawing unit, for crisp strokes and uploads on dense screens
  CANVAS_SCALE: 2,
};
