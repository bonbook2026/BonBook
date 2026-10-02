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
  totalToman?: number;
  totalIrr: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  deliveryStatus: string | null;
  books?: { title: string; priceToman: number | null }[];
  items?: { bookTitle: string; priceToman: number | null }[];
}

export interface BookInfo {
  unitPriceToman: number;
  maxBooksPerOrder: number;
}

export interface BookEntry {
  id: string;
  title: string;
}
