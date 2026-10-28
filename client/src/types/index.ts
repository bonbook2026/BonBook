export interface User {
  id: number;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role?: 'OWNER' | 'ADMIN' | 'READER';
  telegramUsername?: string | null;
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

export interface LibraryBook {
  id: number; title: string; author: string; description: string; category: string;
  language: string; coverTone: string; coverAssetId: string | null; coverUrl: string | null;
  categoryId?:number|null;tags?:string;deletedAt?:string|null;
  coverLayout?: 'SINGLE' | 'SPREAD'; coverFrontSide?: 'LEFT' | 'RIGHT';
  coverSpineStart?: number; coverSpineEnd?: number;
  status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED' | 'TRASH'; isSample: boolean; pageCount: number; updatedAt: string;
  pages?: { number: number; heading: string }[];
  contents?:ContentsEntry[];
}
export interface ContentsEntry{title:string;pageNumber:number;level:number}
export interface LibraryPage {
  id: number; bookId: number; number: number; heading: string; content: string; keywords: string;
  audioAssetId: string | null; audioUrl: string | null; updatedAt: string;
  sourceUrl?:string|null;sourcePageNumber?:number|null;sourceMimeType?:string|null;
  audioCues?:AudioCue[];
}
export interface AudioCue{time:number;offset:number}
export type PageSummary=Pick<LibraryPage,'id'|'number'|'heading'>;
export interface BookCategory{id:number;name:string;parentId:number|null;path:string;bookCount:number}
export interface BookImport{id:string;bookId:number;filename:string;format:string;mode:string;status:'QUEUED'|'PROCESSING'|'REVIEW'|'APPLIED'|'FAILED'|'CANCELED';totalPages:number;completedPages:number;warnings:string;error:string|null;createdAt:string}
export interface ImportedPage{number:number;heading:string;content:string;sourceUrl:string|null;sourcePageNumber:number|null}
export interface SearchResult extends LibraryPage {
  bookTitle: string; author: string; language: string; excerpt: string; matchedTerms: string[];
}
export interface AdminGrant {
  id: number; kind: string; identifier: string; claimedUserId: number | null; createdAt: string;
}
