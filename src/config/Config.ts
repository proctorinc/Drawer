export const Config = {
  ENV: import.meta.env.VITE_ENV || 'development',
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  APP_NAME: 'Daily Doodle',
  CURSOR_SIZE: 20,
  ERASER_COLOR: '#f5f4f0',
  CANVAS_WIDTH: 370,
  CANVAS_HEIGHT: 370,
  LOCAL_STORAGE_KEY: 'drawingPaths',
};
