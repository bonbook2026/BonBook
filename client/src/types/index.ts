export interface User {
  id: number;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role?: 'OWNER' | 'ADMIN' | 'READER';
  telegramUsername?: string | null;
}
export interface SecurityAccount{id:number;firstName:string|null;lastName:string|null;role:string;watermark:string}
export interface ContentSecurityOverview{activeSessions:number;blockedEvents24h:number;account:SecurityAccount|null;sessions:{id:string;current:boolean;account:SecurityAccount;createdAt:string;expiresAt:string}[];events:{id:number;kind:string;createdAt:string;account:SecurityAccount|null}[]}

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
  pages?: { number: number; heading: string;hasAudio?:boolean }[];
  contents?:ContentsEntry[];
}
export interface ContentsEntry{title:string;pageNumber:number;level:number}
export interface LibraryPage {
  protection?:{watermark:string};
  id: number; bookId: number; number: number; heading: string; content: string; keywords: string;
  audioAssetId: string | null; audioUrl: string | null; updatedAt: string;
  sourceUrl?:string|null;sourcePageNumber?:number|null;sourceMimeType?:string|null;
  audioCues?:AudioCue[];
  audioCueMode?:'NONE'|'MANUAL'|'AUTO'|'PARTIAL';
  imageAssetId?:string|null;imageUrl?:string|null;sourceImageUrl?:string|null;visualMode?:'AUTO'|'TEXT'|'IMAGE'|'BOTH';
}
export interface AudioCue{time:number;offset:number}
export interface AudioAlignment{id:string;status:'QUEUED'|'PROCESSING'|'READY'|'REVIEW'|'APPLIED'|'FAILED'|'CANCELED';progress:number;coverage:number;lineCoverage:number;duration?:number;warning:string;error:string|null;cues?:AudioCue[];candidates:{pageNumber:number;score:number;heading:string}[]}
export interface AudioBatchItem{id:string;pageNumber:number;filename:string;size:number;status:'WAITING'|'ATTACHED'|'FAILED'|'SKIPPED';assetId:string|null;error:string|null;alignment?:AudioAlignment|null}
export interface AudioBatch{id:string;bookId:number;status:'UPLOADING'|'COMPLETE'|'CANCELED';autoAlign:boolean;replaceExisting:boolean;items:AudioBatchItem[]}
export type PageSummary=Pick<LibraryPage,'id'|'number'|'heading'>;
export interface BookCategory{id:number;name:string;parentId:number|null;path:string;bookCount:number}
export interface BookImport{id:string;bookId:number;filename:string;format:string;mode:string;status:'QUEUED'|'PROCESSING'|'REVIEW'|'APPLIED'|'FAILED'|'CANCELED';totalPages:number;completedPages:number;warnings:string;error:string|null;createdAt:string}
export interface ImportedPage{number:number;heading:string;content:string;sourceUrl:string|null;sourcePageNumber:number|null}
export interface TextImportItem{sourceNumber:number;number:number;source:string;heading:string;status:'READY'|'REVIEW'|'EMPTY'|'MISSING'|'UNCHANGED';reason:string;similarity:number;cueCount:number;exactCues:number;oldLength:number;newLength:number;canApply:boolean;applied:boolean;beforeContent?:string;content?:string;beforeCues?:AudioCue[];cues?:AudioCue[]}
export interface BookTextImport{id:string;bookId:number;sourceNames:string[];pageOffset:number;status:'PREVIEW'|'APPLIED'|'UNDONE';createdAt:string;appliedAt:string|null;items:TextImportItem[]}
export interface SearchResult extends LibraryPage {
  bookTitle: string; author: string; language: string; excerpt: string; matchedTerms: string[];
}
export interface AdminGrant {
  id: number; kind: string; identifier: string; claimedUserId: number | null; createdAt: string;
}
