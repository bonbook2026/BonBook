import { AuthResponse, BookInfo, Order } from '../types';
import { IS_DEMO } from '../config/demo';

const BASE_URL = '/api';
const TOKEN_KEY = IS_DEMO ? 'bonbook_preview_token' : 'bonbook_token';

let authToken: string | null = null;

export function setToken(token: string) {
  authToken = token;
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  if (!authToken) {
    try {
      authToken = localStorage.getItem(TOKEN_KEY);
    } catch {
      // localStorage may not be available
    }
  }
  return authToken;
}

export function clearToken() {
  authToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (IS_DEMO) {
    const { demoRequest } = await import('./demoApi');
    return demoRequest<T>(path, options, getToken());
  }
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'خطای ناشناخته' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  auth: {
    getLocalTelegramStatus: () => request<{ enabled: boolean }>('/auth/local-telegram'),
    localTelegramLogin: () =>
      request<AuthResponse>('/auth/local-telegram', { method: 'POST' }),
    login: (initData: string) =>
      request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ initData }),
      }),
  },

  users: {
    getProfile: () =>
      request<{
        user: { id: number; telegramId: string; firstName: string | null; lastName: string | null; email: string | null };
        profileComplete: boolean;
        missingFields: string[];
      }>('/users/profile'),

    updateProfile: (data: { firstName?: string; lastName?: string; email?: string }) =>
      request<{
        user: { id: number; telegramId: string; firstName: string | null; lastName: string | null; email: string | null };
        profileComplete: boolean;
        missingFields: string[];
      }>('/users/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  books: {
    getInfo: () => request<BookInfo>('/books/info'),
  },

  orders: {
    create: (books: { title: string }[]) =>
      request<{ order: Order }>(
        '/orders',
        { method: 'POST', body: JSON.stringify({ books }) }
      ),

    getAll: () =>
      request<{ orders: Order[] }>('/orders'),

    getById: (id: number) => request<{ order: unknown }>(`/orders/${id}`),

  },

  payments: {
    initiate: (orderId: number) =>
      request<{ paymentId: string; paymentUrl: string; orderId: number; orderNumber: string; amountIrr: number }>(
        '/payments/initiate',
        { method: 'POST', body: JSON.stringify({ orderId }) }
      ),
  },
};
