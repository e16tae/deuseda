const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
}

export interface TerminalSession {
  id: string;
  title: string;
}

export interface CreateTerminalSessionRequest {
  session_id: string;
  title: string;
}

function getAuthHeaders(includePassword = false): HeadersInit {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  if (includePassword) {
    const password = localStorage.getItem('password');
    if (password) {
      headers['X-SSH-Password'] = password;
    }
  }

  return headers;
}

export const apiClient = {
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Login failed');
    }

    return response.json();
  },

  async getTerminalSessions(): Promise<TerminalSession[]> {
    const response = await fetch(`${API_BASE_URL}/api/terminal-sessions`, {
      method: 'GET',
      headers: getAuthHeaders(true), // Include SSH password
    });

    if (!response.ok) {
      throw new Error('Failed to fetch terminal sessions');
    }

    return response.json();
  },

  async createTerminalSession(data: CreateTerminalSessionRequest): Promise<TerminalSession> {
    const response = await fetch(`${API_BASE_URL}/api/terminal-sessions`, {
      method: 'POST',
      headers: getAuthHeaders(true), // Include SSH password
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to create terminal session');
    }

    return response.json();
  },

  async deleteTerminalSession(sessionId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/terminal-sessions/${sessionId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(true), // Include SSH password
    });

    if (!response.ok && response.status !== 204) {
      throw new Error('Failed to delete terminal session');
    }
  },
};
