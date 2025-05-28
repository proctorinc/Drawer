export const Config = {
  ENV: import.meta.env.ENV || 'development',
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  CURSOR_SIZE: 28,
  CANVAS_WIDTH: 370,
  CANVAS_HEIGHT: 370,
  LOCAL_STORAGE_KEY: 'drawingPaths',
};
