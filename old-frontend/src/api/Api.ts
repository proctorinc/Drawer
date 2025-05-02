// src/api/Api.ts

// Define the base URL for your API
export const API_BASE_URL = 'http://localhost:8002'; // Adjust this if your server runs on a different port or host

// Type definitions for the responses
export interface DailyPrompt {
    day: string;
    colors: string[];
    prompt: string;
    isCompleted: boolean;
}

export interface User {
    id: string;
    name: string;
    email: string;
}

export interface UserPromptSubmission extends DailyPrompt {
    imageUrl: string;
    user: User;
}

export interface GetMeResponse {
    user: User;
    prompts: UserPromptSubmission[];
    feed: Map<string, UserPromptSubmission[]>;
}

// Function to fetch the daily prompt
export async function fetchDailyPrompt(): Promise<DailyPrompt> {
    const response = await fetch(`${API_BASE_URL}/daily`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Error fetching daily prompt: ${response.statusText}`);
    }

    return await response.json();
}

// Function to fetch user profile and submissions
export async function fetchUserProfile(): Promise<GetMeResponse> {
    const response = await fetch(`${API_BASE_URL}/me`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Error fetching user profile: ${response.statusText}`);
    }

    return await response.json();
}

export async function submitDailyPrompt(image: Blob): Promise<void> {
    const formData = new FormData();
    formData.append('image', image, 'canvas.png');

    const response = await fetch(`${API_BASE_URL}/daily`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Error submitting daily prompt: ${response.statusText}`);
    }

    return await response.json();
}