import { AuthResponse } from '../types';

const BASE_URL = '/api';

let authToken: string | null = null;

export function setToken(token: string) {
  authToken = token;
  localStorage.setItem('bonbook_token', token);
}

export function getToken(): string | null {
  if (!authToken) {
    try {
      authToken = localStorage.getItem('bonbook_token');
    } catch {
      // localStorage may not be available
    }
  }
  return authToken;
}

export function clearToken() {
  authToken = null;
  try {
    localStorage.removeItem('bonbook_token');
  } catch {
    // ignore
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
    getInfo: () => request<{ unitPriceUsd: number; maxBooksPerOrder: number }>('/books/info'),
  },

  orders: {
    create: (books: { title: string }[]) =>
      request<{ order: { id: number; orderNumber: string; books: { title: string; priceUsd: number }[]; totalBooks: number; totalUsd: number; exchangeRate: number; totalIrr: number; status: string } }>(
        '/orders',
        { method: 'POST', body: JSON.stringify({ books }) }
      ),

    getAll: () =>
      request<{
        orders: {
          id: number;
          orderNumber: string;
          totalBooks: number;
          totalUsd: number;
          totalIrr: number;
          status: string;
          createdAt: string;
          paidAt: string | null;
          deliveryStatus: string | null;
        }[];
      }>('/orders'),

    getById: (id: number) => request<{ order: unknown }>(`/orders/${id}`),

    getExchangeRate: () =>
      request<{ rate: number; source: string; timestamp: string }>('/orders/exchange-rate'),
  },

  payments: {
    initiate: (orderId: number) =>
      request<{ paymentId: string; paymentUrl: string; orderId: number; orderNumber: string; amountIrr: number }>(
        '/payments/initiate',
        { method: 'POST', body: JSON.stringify({ orderId }) }
      ),
  },
};
