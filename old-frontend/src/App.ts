// src/index.ts
import { CanvasManager } from './CanvasManager';
import { AppState, ToolType } from './AppState';
import { ITool } from './tools/ITool';
import { PencilTool } from './tools/PencilTool';
import { API_BASE_URL, fetchDailyPrompt, fetchUserProfile, submitDailyPrompt, UserPromptSubmission } from './api/Api';
import { formatDate, getFirstTwoLetters } from './utils/utils';

class DrawingApp {
    private canvasManager: CanvasManager;
    private state: AppState;
    private tools: Map<ToolType, ITool>;
    private activeTool: ITool;

    constructor() {
        this.canvasManager = new CanvasManager('drawingCanvas');
        this.tools = new Map();
        this.state = new AppState();

        this.registerTool(new PencilTool());

        this.activeTool = this.tools.get(this.state.currentTool)!;

        // Fetch data from server and initialize the app
        this.fetchData().then(() => this.init());
    }

    private registerTool(tool: ITool): void {
        this.tools.set(tool.name as ToolType, tool);
    }

    private updateUIToMatchState(): void {
        console.log(this.state)
        // loop over settings.colors and set the color of the color picker to the first color
        for (let i = 0; i < this.state.settings.colors.length; i++) {
            const colorPicker = document.getElementById(`colorPicker${i + 1}`) as HTMLInputElement;
            if (colorPicker) colorPicker.style.backgroundColor = this.state.settings.colors[i];
        }

        const promptText = document.getElementById('promptText') as HTMLSpanElement;
        if (promptText) promptText.textContent = this.state.prompt;

        const lineWidthSlider = document.getElementById('lineWidth') as HTMLInputElement;
        if (lineWidthSlider) lineWidthSlider.value = String(this.state.settings.lineWidth);

         // Update active tool button UI if you have that feature
         this.updateActiveButtonUI(this.state.currentTool);
     }

     private updateActiveButtonUI(activeTool: ToolType): void {
         // Remove 'active' class from all tool buttons
         this.tools.forEach((_, toolType) => {
             document.getElementById(`${toolType}Tool`)?.classList.remove('active');
         });
         // Add 'active' class to the current tool button
         document.getElementById(`${activeTool}Tool`)?.classList.add('active');
     }


    private setupUIListeners(): void {
        // Tool selection buttons
        document.getElementById('pencilTool')?.addEventListener('click', () => this.setActiveTool(ToolType.PENCIL));

        if (this.state.settings.colors) {
            // Settings inputs
            for (let i = 0; i < this.state.settings.colors.length; i++) {
                const colorPicker = document.getElementById(`colorPicker${i + 1}`) as HTMLInputElement;
                console.log(`Color picker ${i + 1}: ${this.state.settings.colors[i]} [${!!colorPicker}]`);
                colorPicker?.addEventListener('click', (e) => {
                    console.log(`Selected color picker${i + 1}: ${this.state.settings.colors[i]} [${i}]`);
                    this.state.setSetting('selectedColor', this.state.settings.colors[i]);
                    this.highlightColorPicker(i);
                });
            }
        }

        const submitButton = document.getElementById('submitBtn')
        submitButton?.addEventListener('click', async () => {
            const canvas = this.canvasManager.canvas; // Assuming you have a method to get the canvas
            const dataURL = canvas.toDataURL('image/png'); // Convert canvas to PNG data URL
            const blob = await (await fetch(dataURL)).blob(); // Convert data URL to Blob
            const result = await submitDailyPrompt(blob);
            console.log(result);

            this.state.clearShapes();
            this.redrawCanvas();
        });

        const eraserButton = document.getElementById('eraseBtn')
        eraserButton?.addEventListener('click', () => {
            this.state.setSetting('selectedColor', undefined);
            this.state.saveState();
        });

        const lineWidthSlider = document.getElementById('lineWidth') as HTMLInputElement;
        lineWidthSlider?.addEventListener('input', (e) => {
            this.state.setSetting('lineWidth', parseInt((e.target as HTMLInputElement).value, 10));
        });

        // Action buttons
        document.getElementById('undoBtn')?.addEventListener('click', () => {
            this.state.undo(); // undo() now calls saveState()
            this.redrawCanvas();
        });
        document.getElementById('clearBtn')?.addEventListener('click', () => {
            // Use the new method in AppState
            this.state.clearShapes(); // clearShapes() now calls saveState()
            this.redrawCanvas();
        });
    }

    private setActiveTool(toolType: ToolType): void {
        const tool = this.tools.get(toolType);
        if (tool) {
            this.state.setCurrentTool(toolType);
            this.activeTool = tool;
            console.log(`Tool changed to: ${toolType}`);
            this.updateActiveButtonUI(toolType); // Update UI
            // Note: Tool changes aren't automatically persisted unless you add saveState() here or in setCurrentTool
        }
    }

    private highlightColorPicker(selectedIndex: number): void {

        if (this.state.settings.colors) {
            // Remove 'selected' class from all color pickers
            for (let i = 0; i < this.state.settings.colors.length; i++) {
                const colorPicker = document.getElementById(`colorPicker${i + 1}`) as HTMLButtonElement;
                if (colorPicker) {
                    colorPicker.classList.remove('selected');
                }
            }
        }
    
        // Add 'selected' class to the currently selected color picker
        const selectedColorPicker = document.getElementById(`colorPicker${selectedIndex + 1}`) as HTMLButtonElement;
        if (selectedColorPicker) {
            selectedColorPicker.classList.add('selected');
        }
    }

    private setupCanvasListeners(): void {
        // ... (keep existing canvas listeners: mousedown, mousemove, mouseup, mouseleave)
         const canvas = this.canvasManager.getElement();
         canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
         canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
         canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
         canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    }

    // --- Event Handlers (handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave) ---
    // No changes needed here, as they call AppState methods which now handle saving.
    private handleMouseDown(event: MouseEvent | TouchEvent): void {
         if (this.activeTool?.onMouseDown) {
             this.activeTool.onMouseDown(event, this.state, this.canvasManager.getContext());
         }
     }

     private handleMouseMove(event: MouseEvent | TouchEvent): void {
         if (this.state.isDrawing && this.activeTool?.onMouseMove) {
             this.activeTool.onMouseMove(event, this.state, this.canvasManager.getContext());
         }
     }

     private handleMouseUp(event: MouseEvent | TouchEvent): void {
         // Check if we were actually drawing with a tool
         const wasDrawing = this.state.isDrawing;
         if (wasDrawing && this.activeTool?.onMouseUp) {
             this.activeTool.onMouseUp(event, this.state, this.canvasManager.getContext());
             // onMouseUp should call state.addShape which triggers saveState()
         }
         // Ensure drawing state is reset, even if onMouseUp wasn't called or didn't set it
         if (wasDrawing) {
             this.state.isDrawing = false;
             // Redraw only if an action potentially completed
             this.redrawCanvas();
         }
     }

     private handleMouseLeave(event: MouseEvent): void {
         if (this.state.isDrawing) {
             this.handleMouseUp(event); // Treat leave as mouse up
         }
     }

    private redrawCanvas(): void {
        this.canvasManager.redraw(this.state.shapes);
    }

    private updatePromptList(submissions?: Map<string, UserPromptSubmission[]>): void {
        const promptList = document.getElementById('promptList') as HTMLDivElement;
        promptList.innerHTML = ''; // Clear existing entries
    
        const submissionMap = new Map<string, UserPromptSubmission[]>(
            Object.entries(submissions).map(([day, submissionlist]) => [day, submissionlist])
        );

        console.log(typeof submissionMap);

        for (const [date, prompts] of submissionMap.entries()) {
            prompts.forEach((prompt) => {
                const entry = document.createElement('div');
                entry.className = 'card';
                entry.innerHTML = `
                    <div class="card-header">
                        <div class="card-header-content">
                            <div class="prompt">
                                <div class="prompt-date">
                                    <span id="promptDate">${formatDate(prompt.day)}</span>
                                </div>
                                <span>Draw <span id="completedPromptText">${prompt.prompt}</span></span>
                            </div>
                            <div class="profile-picture">${getFirstTwoLetters(prompt.user.name)}</div>
                        </div>
                    </div>
                    <img class="completed-drawing" src="${API_BASE_URL}${prompt.imageUrl}" alt="Daily Prompt Image" id="promptImage">
                `;
                promptList.appendChild(entry);
            });
        };
    }

    private async fetchData() {
        try {
            const userProfile = await fetchUserProfile();
            console.log('Fetched User Profile:', userProfile);
            this.state.setUserProfile(userProfile);

            // Draw the prompts
            this.updatePromptList(this.state.profile?.feed)
        } catch (error) {
            console.error('Error fetching user profile:', error);
        }
        
        try {
            const dailyPrompt = await fetchDailyPrompt();
            console.log('Fetched Daily Prompt:', dailyPrompt);
            this.state.setDailyPrompt(dailyPrompt);

            if (!dailyPrompt.isCompleted) {
                console.log('Daily prompt is not completed');
                const drawingCanvasContainer = document.getElementById('drawingCanvasContainer') as HTMLDivElement;
                drawingCanvasContainer.style.display = 'block';
            } else {
                const promptList = document.getElementById('promptList') as HTMLDivElement;
                promptList.style.display = 'flex';
            }
        } catch (error) {
            console.error('Error fetching daily prompt:', error);
        }
    }

    private init(): void {
        this.setupUIListeners();
        this.setupCanvasListeners();
        this.updateUIToMatchState()
        this.redrawCanvas();
    }
}

// Initialize the app
window.addEventListener('load', () => {
    new DrawingApp();
});