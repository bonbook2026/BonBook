export interface User {
  id: number;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
  profileComplete: boolean;
  missingFields: string[];
}

export interface Order {
  id: number;
  orderNumber: string;
  totalBooks: number;
  totalUsd: number;
  totalIrr: number;
  exchangeRate: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  deliveryStatus: string | null;
  books?: { title: string; priceUsd: number }[];
  items?: { bookTitle: string; priceUsd: number }[];
}

export interface BookInfo {
  unitPriceUsd: number;
  maxBooksPerOrder: number;
}

export interface ExchangeRate {
  rate: number;
  source: string;
  timestamp: string;
}

export interface BookEntry {
  id: string;
  title: string;
}
