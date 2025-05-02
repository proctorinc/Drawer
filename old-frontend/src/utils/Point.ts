export interface Point {
    x: number;
    y: number;
}

export function getEventPoint(event: MouseEvent | TouchEvent, canvas: HTMLCanvasElement): Point {
    const rect = canvas.getBoundingClientRect();
    let clientX: number;
    let clientY: number;

    if (event instanceof MouseEvent) {
        clientX = event.clientX;
        clientY = event.clientY;
    } else { // TouchEvent
        // Handle potential multiple touch points, e.g., use the first touch
        if (event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else if (event.changedTouches.length > 0) { // Use changedTouches for touchend
             clientX = event.changedTouches[0].clientX;
             clientY = event.changedTouches[0].clientY;
        } else {
            // Fallback or error
            return { x: 0, y: 0 };
        }
    }

    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}