import { DailyPrompt, GetMeResponse } from './api/Api';
import { IShape, SerializedShape } from './shapes/IShape';
import { createShapeFromData } from './shapes/ShapeFactory'; // Import the factory

export enum ToolType {
    PENCIL = 'pencil',
    LINE = 'line',
    RECTANGLE = 'rectangle',
    ERASER = 'eraser',
}

export interface DrawingSettings {
    selectedColor?: string;
    colors: string[];
    lineWidth: number;
    fillColor?: string;
}

const LOCAL_STORAGE_KEY = 'drawingAppState'; // Define a key for localStorage

export class AppState {
    public currentTool: ToolType = ToolType.PENCIL;
    public settings: DrawingSettings = {
        colors: [],
        lineWidth: 32,
    };
    public profile: GetMeResponse | null = null;
    public prompt: string = '';
    public shapes: IShape[] = [];
    public isDrawing: boolean = false;
    public isTodayCompleted: boolean = false;
    // Add undo/redo stacks if needed

    constructor() {
        // Attempt to load state when the AppState is instantiated
        this.loadState();
    }

    setDailyPrompt(data: DailyPrompt): void {
        console.log('Setting daily prompt:', data);
        this.settings.colors = data.colors;
        this.prompt = data.prompt;
        this.isTodayCompleted = data.isCompleted;
    }

    setUserProfile(data: GetMeResponse): void {
        this.profile = data;
    }

    // --- Existing methods ---
    setCurrentTool(tool: ToolType): void {
        this.currentTool = tool;
    }

    setSetting<K extends keyof DrawingSettings>(key: K, value: DrawingSettings[K]): void {
        this.settings[key] = value;
        // Note: Settings changes aren't saved automatically here,
        // but you could add saving logic if needed.
    }

    addShape(shape: IShape): void {
        this.shapes.push(shape);
        this.saveState(); // Save whenever a shape is added
    }

    undo(): void {
        if (this.shapes.length > 0) {
            this.shapes.pop();
            this.saveState(); // Save after undo
        }
    }

    clearShapes(): void {
         this.shapes = [];
         this.saveState(); // Save after clearing
     }

    // --- New methods for saving/loading ---

    /**
     * Serializes the current shapes array and saves it to localStorage.
     */
    saveState(): void {
        try {
            const serializedShapes = this.shapes.map(shape => shape.serialize());
            const stateJson = JSON.stringify(serializedShapes);
            localStorage.setItem(LOCAL_STORAGE_KEY, stateJson);
            console.log('Drawing state saved.');
        } catch (error) {
            console.error('Failed to save drawing state:', error);
            // Handle potential errors (e.g., localStorage full)
        }
    }

    /**
     * Loads the shapes array from localStorage and deserializes it.
     */
    loadState(): void {
        try {
            const savedStateJson = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedStateJson) {
                const serializedShapes: SerializedShape[] = JSON.parse(savedStateJson);

                // Clear existing shapes before loading
                this.shapes = [];

                serializedShapes.forEach(data => {
                    const shapeInstance = createShapeFromData(data);
                    if (shapeInstance) {
                        this.shapes.push(shapeInstance);
                    }
                });
                console.log('Drawing state loaded.');
            } else {
                console.log('No saved drawing state found.');
            }
        } catch (error) {
            console.error('Failed to load or parse drawing state:', error);
            // Handle potential errors (e.g., corrupted data)
            this.shapes = []; // Reset to empty state on error
        }
    }
}