import { Config } from '@/config/Config';

export interface DailyPrompt {
  day: string;
  colors: Array<string>;
  prompt: string;
  isCompleted: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
}

export interface UserPromptSubmission extends DailyPrompt {
  canvasData: string;
  user: User;
}

export interface GetMeResponse {
  user: User;
  prompts: Array<UserPromptSubmission>;
  feed: Map<string, Array<UserPromptSubmission>>;
  friends: Array<User>;
}

async function fetchAPI(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  return await fetch(`${Config.API_BASE_URL}${endpoint}`, {
    credentials: 'include',
    method,
    ...options,
  });
}

export async function fetchDailyPrompt(): Promise<DailyPrompt> {
  const response = await fetchAPI('GET', '/daily');

  if (!response.ok) {
    throw new Error(`Error fetching daily prompt: ${response.statusText}`);
  }

  return (await response.json()) as Promise<DailyPrompt>;
}

export async function fetchUserProfile(): Promise<GetMeResponse> {
  const response = await fetchAPI('GET', '/me');

  if (!response.ok) {
    throw new Error(`Error fetching user profile: ${response.statusText}`);
  }

  return (await response.json()) as Promise<GetMeResponse>;
}

export async function submitDailyPrompt(
  canvasData: string,
): Promise<{ message: string }> {
  const response = await fetchAPI('POST', '/daily', {
    body: JSON.stringify({ canvasData }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error submitting daily prompt: ${response.statusText}`);
  }

  return (await response.json()) as Promise<{ message: string }>;
}

export async function createUser(
  username: string,
  email: string,
): Promise<{ message: string }> {
  const response = await fetchAPI('POST', '/register', {
    body: JSON.stringify({ username, email }),
  });

  if (!response.ok) {
    throw new Error(`Error creating user: ${response.statusText}`);
  }

  return (await response.json()) as Promise<{ message: string }>;
}

export async function loginUser(email: string): Promise<{ message: string }> {
  const response = await fetchAPI('POST', '/login', {
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error(`Error logging in: ${response.statusText}`);
  }

  return (await response.json()) as Promise<{ message: string }>;
}

export async function logoutUser(): Promise<{ message: string }> {
  const response = await fetchAPI('POST', '/logout');

  if (!response.ok) {
    throw new Error(`Error logging out: ${response.statusText}`);
  }

  return (await response.json()) as Promise<{ message: string }>;
}

export async function addFriend(friendID: string): Promise<void> {
  const response = await fetchAPI('POST', '/add-friend', {
    body: JSON.stringify({ friendID }),
  });

  if (!response.ok) {
    throw new Error(`Error adding friend: ${response.statusText}`);
  }

  return (await response.json()) as Promise<void>;
}

export async function fetchUserByID(userID: string): Promise<User> {
  const response = await fetchAPI('GET', `/user/${userID}`);

  if (!response.ok) {
    throw new Error(`Error fetching user: ${response.statusText}`);
  }

  return (await response.json()) as Promise<User>;
}
