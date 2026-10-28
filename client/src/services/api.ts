import { AuthResponse, BookInfo, Order, User, LibraryBook, LibraryPage, SearchResult, AdminGrant } from '../types';
import { IS_DEMO, IS_PREPRODUCTION } from '../config/demo';

const BASE_URL = '/api';
export const mediaUrl = (url: string | null) => url && url.startsWith('/api/media/') ? url : null;
const TOKEN_KEY = IS_DEMO ? 'bonbook_preview_token' : IS_PREPRODUCTION ? 'bonbook_preproduction_token' : 'bonbook_token';

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
    options: () => request<{google: boolean; telegramBotUrl: string}>('/auth/options'),
    session: () => request<AuthResponse>('/auth/session'),
    logout: () => request<{ok: boolean}>('/auth/logout', { method: 'POST' }),
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
        user: User;
        profileComplete: boolean;
        missingFields: string[];
      }>('/users/profile'),

    updateProfile: (data: { firstName?: string; lastName?: string; email?: string }) =>
      request<{
        user: User;
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
  library: {
    list: () => request<{books: LibraryBook[]; categories: string[]}>('/library'),
    book: (id: number) => request<{book: LibraryBook}>(`/library/${id}`),
    page: (id: number, page: number) => request<{page: LibraryPage}>(`/library/${id}/pages/${page}`),
    search: (q: string, bookId?: number) => request<{query: string; results: SearchResult[]}>(`/library/search?q=${encodeURIComponent(q)}${bookId ? '&bookId=' + bookId : ''}`),
    progress: () => request<{progress: {book: LibraryBook; pageNumber: number; updatedAt: string}[]}>('/library/progress'),
    saveProgress: (bookId: number, pageNumber: number) => request<{ok: boolean}>('/library/progress', {method:'PUT', body:JSON.stringify({bookId,pageNumber})}),
  },
  admin: {
    books: () => request<{books: LibraryBook[]}>('/admin/books'),
    createBook: (title: string) => request<{book: LibraryBook}>('/admin/books', {method:'POST',body:JSON.stringify({title})}),
    book: (id: number) => request<{book: LibraryBook; pages: LibraryPage[]}>(`/admin/books/${id}`),
    saveBook: (book: LibraryBook) => request<{book: LibraryBook}>(`/admin/books/${book.id}`, {method:'PUT',body:JSON.stringify(book)}),
    archiveBook: (id: number) => request<{ok:boolean}>(`/admin/books/${id}`, {method:'DELETE'}),
    savePage: (bookId: number, page: Pick<LibraryPage,'number'|'heading'|'content'|'keywords'|'audioAssetId'>) => request<{page:LibraryPage}>(`/admin/books/${bookId}/pages/${page.number}`, {method:'PUT',body:JSON.stringify(page)}),
    deletePage: (bookId: number, page: number) => request<{ok:boolean}>(`/admin/books/${bookId}/pages/${page}`, {method:'DELETE'}),
    access: () => request<{grants:AdminGrant[]}>('/admin/access'),
    addAdmin: (identifier: string) => request<{grant:AdminGrant}>('/admin/access', {method:'POST',body:JSON.stringify({identifier})}),
    removeAdmin: (id:number) => request<{ok:boolean}>(`/admin/access/${id}`, {method:'DELETE'}),
    upload: async (kind: 'cover'|'audio', file: File) => {
      const data = new FormData(); data.append('file',file);
      const response = await fetch(`${BASE_URL}/admin/media/${kind}`, {method:'POST',headers:{Authorization:`Bearer ${getToken() || ''}`},body:data});
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'بارگذاری انجام نشد.');
      return result as {asset:{id:string;url:string}};
    },
    mediaBlob: async (id:string) => {
      const response = await fetch(`${BASE_URL}/media/${id}`, {headers:{Authorization:`Bearer ${getToken() || ''}`}});
      if (!response.ok) throw new Error('فایل در دسترس نیست.'); return response.blob();
    },
  },
};
