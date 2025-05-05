export const Config = {
    // Get from vite environment variable
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8002",
    CURSOR_SIZE: 32,
    CANVAS_WIDTH: 370,
    CANVAS_HEIGHT: 370,
    LOCAL_STORAGE_KEY: "drawingPaths",
}