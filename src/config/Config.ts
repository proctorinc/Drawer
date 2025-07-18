export const Config = {
  ENV: import.meta.env.VITE_ENV || 'production',
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  VAPID_PUBLIC_KEY:
    import.meta.env.VITE_VAPID_PUBLIC_KEY ||
    'BPA-gbCMFRfVEVwaxNuZQ06iWePK3pgeIXwC2QqlOcCvInoWzH363rt9R9n-tffjgq_vJUSBpa4sl2P2It5EVYY',
  APP_NAME: 'The Daily Doodle',
  CURSOR_SIZE: 20,
  ERASER_COLOR: '#f5f4f0',
  CANVAS_WIDTH: 370,
  CANVAS_HEIGHT: 370,
  LOCAL_STORAGE_KEY: 'drawingPaths',
};

console.log('Loaded Config:');
console.log(Config);
console.log(import.meta.env);
