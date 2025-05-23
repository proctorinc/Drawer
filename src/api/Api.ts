import { Config } from "@/config/Config";

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
    canvasData: string;
    user: User;
}

export interface GetMeResponse {
    user: User;
    prompts: UserPromptSubmission[];
    feed: Map<string, UserPromptSubmission[]>;
    friends: User[];
}

async function fetchAPI(method: 'GET' | 'POST' | 'PUT' | 'DELETE', endpoint: string, options: RequestInit = {}): Promise<Response> {
    return await fetch(`${Config.API_BASE_URL}${endpoint}`, {
        credentials: 'include',
        method,
        ...options,
    });
}

export async function fetchDailyPrompt(): Promise<DailyPrompt> {
    const response = await fetchAPI("GET", "/daily");

    if (!response.ok) {
        throw new Error(`Error fetching daily prompt: ${response.statusText}`);
    }

    return await response.json() as Promise<DailyPrompt>;
}

export async function fetchUserProfile(): Promise<GetMeResponse> {
    const response = await fetchAPI("GET", "/me");

    if (!response.ok) {
        throw new Error(`Error fetching user profile: ${response.statusText}`);
    }

    return await response.json() as Promise<GetMeResponse>;
}

export async function submitDailyPrompt(canvasData: string): Promise<void> {
    const response = await fetchAPI("POST", "/daily", {
        body: JSON.stringify({ canvas_data: canvasData }),
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Error submitting daily prompt: ${response.statusText}`);
    }

    return await response.json() as Promise<void>;
}

export async function createUser(name: string, email: string): Promise<GetMeResponse> {
    const response = await fetchAPI("POST", "/register", {
        body: JSON.stringify({ name, email }),
    });

    if (!response.ok) {
        throw new Error(`Error creating user: ${response.statusText}`);
    }

    return await response.json() as Promise<GetMeResponse>;
}

export async function loginUser(email: string): Promise<GetMeResponse> {
    const response = await fetchAPI("POST", "/login", {
        body: JSON.stringify({ email }),
    });

    if (!response.ok) {
        throw new Error(`Error logging in: ${response.statusText}`);
    }

    return await response.json() as Promise<GetMeResponse>;
}

export async function addFriend(friendID: string): Promise<void> {
    const response = await fetchAPI("POST", "/add-friend", {
        body: JSON.stringify({ friendID }),
    });

    if (!response.ok) {
        throw new Error(`Error adding friend: ${response.statusText}`);
    }

    return await response.json() as Promise<void>;
}