import type { Order, User } from '../types';

const STATE_KEY = 'bonbook_preview_state_v1';
const DEMO_TOKEN = 'bonbook-preview-session';
const BOOK_PRICE_TOMAN = 1_500_000;
const MAX_BOOKS = 10;

interface DemoState {
  version: 1;
  user: User;
  orders: Order[];
  nextOrderId: number;
}

let memoryState: DemoState | null = null;

function initialState(): DemoState {
  return {
    version: 1,
    user: {
      id: 1,
      telegramId: 'preview:telegram:bonbook',
      firstName: 'کاربر',
      lastName: 'آزمایشی',
      email: 'reader@example.com',
    },
    orders: [],
    nextOrderId: 1,
  };
}

function readState(): DemoState {
  if (memoryState) return memoryState;
  try {
    const saved = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
    if (saved?.version === 1 && saved.user?.telegramId === 'preview:telegram:bonbook' &&
        Array.isArray(saved.orders) && Number.isInteger(saved.nextOrderId)) {
      memoryState = saved;
    }
  } catch {
    // A fresh preview also works when browser storage is unavailable or corrupt.
  }
  memoryState ??= initialState();
  return memoryState;
}

function saveState(state: DemoState) {
  memoryState = state;
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch { /* Keep this session usable. */ }
}

export function resetDemoState() {
  memoryState = initialState();
  try { localStorage.removeItem(STATE_KEY); } catch { /* Memory is already reset. */ }
}

function profileResponse(user: User) {
  const missingFields = [
    ...(!user.firstName ? ['نام'] : []),
    ...(!user.lastName ? ['نام خانوادگی'] : []),
    ...(!user.email ? ['ایمیل'] : []),
  ];
  return { user, profileComplete: missingFields.length === 0, missingFields };
}

// This adapter never fetches an API, authenticates Telegram, sends email, or charges money.
export async function demoRequest<T>(path: string, options: RequestInit, token: string | null): Promise<T> {
  const state = readState();
  const method = options.method || 'GET';
  let result: unknown;

  if (path === '/auth/local-telegram' && method === 'GET') {
    result = { enabled: true };
  } else if (path === '/auth/local-telegram' && method === 'POST') {
    saveState(state);
    result = { token: DEMO_TOKEN, ...profileResponse(state.user) };
  } else {
    if (token !== DEMO_TOKEN) throw new Error('برای ادامه، با حساب آزمایشی وارد شوید.');
    const body = options.body ? JSON.parse(String(options.body)) : {};

    if (path === '/users/profile' && method === 'GET') {
      result = profileResponse(state.user);
    } else if (path === '/users/profile' && method === 'PUT') {
      const user = { ...state.user };
      for (const field of ['firstName', 'lastName', 'email'] as const) {
        if (body[field] !== undefined) {
          if (typeof body[field] !== 'string') throw new Error('اطلاعات پروفایل معتبر نیست.');
          user[field] = body[field].trim();
        }
      }
      if (!user.firstName) throw new Error('نام نمی‌تواند خالی باشد');
      if (!user.lastName) throw new Error('نام خانوادگی نمی‌تواند خالی باشد');
      if (user.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
        throw new Error('آدرس ایمیل معتبر نیست');
      }
      state.user = user;
      saveState(state);
      result = profileResponse(user);
    } else if (path === '/books/info' && method === 'GET') {
      result = { unitPriceToman: BOOK_PRICE_TOMAN, maxBooksPerOrder: MAX_BOOKS };
    } else if (path === '/orders' && method === 'POST') {
      if (!profileResponse(state.user).profileComplete) throw new Error('پروفایل ناقص است');
      if (!Array.isArray(body.books) || !body.books.length || body.books.length > MAX_BOOKS ||
          body.books.some((book: { title?: unknown } | null) => typeof book?.title !== 'string' || !book.title.trim())) {
        throw new Error('عنوان کتاب‌ها و تعداد سفارش را بررسی کنید.');
      }
      const books = body.books.map((book: { title: string }) => ({ title: book.title.trim(), priceToman: BOOK_PRICE_TOMAN }));
      const id = state.nextOrderId++;
      const order: Order = {
        id,
        orderNumber: `DEMO-${String(id).padStart(4, '0')}`,
        books,
        totalBooks: books.length,
        totalToman: books.length * BOOK_PRICE_TOMAN,
        totalIrr: books.length * BOOK_PRICE_TOMAN * 10,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        paidAt: null,
        deliveryStatus: null,
      };
      state.orders.unshift(order);
      saveState(state);
      result = { order };
    } else if (path === '/orders' && method === 'GET') {
      result = { orders: state.orders };
    } else if (/^\/orders\/\d+$/.test(path) && method === 'GET') {
      const order = state.orders.find((item) => item.id === Number(path.split('/').pop()));
      if (!order) throw new Error('سفارش یافت نشد');
      result = { order };
    } else if (path === '/payments/initiate' && method === 'POST') {
      const order = state.orders.find((item) => item.id === body.orderId);
      if (!order) throw new Error('سفارش یافت نشد');
      order.status = 'PAID';
      order.paidAt = new Date().toISOString();
      // Delivery stays unset: the preview does not send any books or emails.
      saveState(state);
      const paymentUrl = new URL(window.location.href);
      paymentUrl.hash = `/success?order=${encodeURIComponent(order.orderNumber)}`;
      result = { paymentId: `demo-${order.id}`, paymentUrl: paymentUrl.href, orderId: order.id,
        orderNumber: order.orderNumber, amountIrr: order.totalIrr };
    } else {
      throw new Error('این عملیات در پیش‌نمایش آزمایشی در دسترس نیست.');
    }
  }

  // Return detached data just like a JSON response from the real API.
  return JSON.parse(JSON.stringify(result)) as T;
}
