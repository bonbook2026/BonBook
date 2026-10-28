import { AuthResponse, BookInfo, Order, User, LibraryBook, LibraryPage, SearchResult, AdminGrant,PageSummary,BookCategory,BookImport,ImportedPage,ContentsEntry,AudioBatch,AudioAlignment } from '../types';
import { IS_DEMO, IS_PREPRODUCTION } from '../config/demo';

const BASE_URL = '/api';
export const mediaUrl = (url: string | null) => url && url.startsWith('/api/media/') ? url : null;
export class ApiError extends Error {
  constructor(message:string,public status:number,public retryAfterSeconds=0){super(message);this.name='ApiError';}
}
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
    throw new ApiError(error.error || `HTTP ${response.status}`,response.status,Number(response.headers.get('Retry-After'))||0);
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
    audioOptions:(id:number)=>request<{pages:{number:number;heading:string;audioAssetId:string|null}[];speech:boolean;maxFileBytes:number;maxFiles:number}>(`/admin/books/${id}/audio-options`),
    audioBatches:(id:number)=>request<{batches:AudioBatch[]}>(`/admin/books/${id}/audio-batches`),
    createAudioBatch:(id:number,files:{filename:string;pageNumber:number;size:number}[],replaceExisting:boolean,autoAlign:boolean)=>request<{batch:AudioBatch}>(`/admin/books/${id}/audio-batches`,{method:'POST',body:JSON.stringify({files,replaceExisting,autoAlign})}),
    audioBatch:(id:string)=>request<{batch:AudioBatch}>(`/admin/audio-batches/${id}`),
    cancelAudioBatch:(id:string)=>request<{ok:boolean}>(`/admin/audio-batches/${id}`,{method:'DELETE'}),
    uploadBatchAudio:(batchId:string,itemId:string,file:File,onProgress:(percent:number)=>void)=>new Promise<void>((resolve,reject)=>{
      const xhr=new XMLHttpRequest(),body=new FormData();body.append('file',file);xhr.open('POST',`${BASE_URL}/admin/media/audio-batches/${batchId}/items/${itemId}`);const token=getToken();if(token)xhr.setRequestHeader('Authorization','Bearer '+token);
      xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress(event.loaded/event.total*100);};xhr.onerror=()=>reject(new Error('ارتباط قطع شد؛ می‌توانی بارگذاری را ادامه بدهی.'));xhr.onload=()=>{if(xhr.status>=200&&xhr.status<300)resolve();else{let message='بارگذاری کامل نشد.';try{message=JSON.parse(xhr.responseText).error||message;}catch{}reject(new Error(message));}};xhr.send(body);
    }),
    pageAlignment:(id:number,page:number)=>request<{available:boolean;alignment:AudioAlignment|null}>(`/admin/books/${id}/pages/${page}/alignment`),
    startAlignment:(id:number,page:number)=>request<{alignment:AudioAlignment}>(`/admin/books/${id}/pages/${page}/alignment`,{method:'POST'}),
    alignment:(id:string)=>request<{alignment:AudioAlignment}>(`/admin/alignments/${id}`),
    applyAlignment:(id:string,replaceManual=false)=>request<{alignment:AudioAlignment}>(`/admin/alignments/${id}/apply`,{method:'POST',body:JSON.stringify({replaceManual})}),
    cancelAlignment:(id:string)=>request<{ok:boolean}>(`/admin/alignments/${id}`,{method:'DELETE'}),
    alignBook:(id:number,replaceExisting=false)=>request<{queued:number;skipped:number}>(`/admin/books/${id}/align-audio`,{method:'POST',body:JSON.stringify({replaceExisting})}),
    books: (filters:Record<string,string>={}) => request<{books: LibraryBook[];total:number;page:number;pageSize:number;counts:Record<string,number>}>('/admin/books?'+new URLSearchParams(filters)),
    createBook: (title: string) => request<{book: LibraryBook}>('/admin/books', {method:'POST',body:JSON.stringify({title})}),
    book: (id: number) => request<{book: LibraryBook; pages: PageSummary[]}>(`/admin/books/${id}`),
    page: (id:number,page:number)=>request<{page:LibraryPage}>(`/admin/books/${id}/pages/${page}`),
    contents:(id:number)=>request<{contents:ContentsEntry[]}>(`/admin/books/${id}/contents`),
    saveContents:(id:number,contents:ContentsEntry[])=>request<{contents:ContentsEntry[]}>(`/admin/books/${id}/contents`,{method:'PUT',body:JSON.stringify({contents})}),
    suggestContents:(id:number,from:number,to:number)=>request<{contents:ContentsEntry[];warning:string}>(`/admin/books/${id}/contents/suggest`,{method:'POST',body:JSON.stringify({from,to})}),
    saveBook: (book: LibraryBook) => request<{book: LibraryBook}>(`/admin/books/${book.id}`, {method:'PUT',body:JSON.stringify(book)}),
    state:(id:number,action:string)=>request<{book:LibraryBook}>(`/admin/books/${id}/state`,{method:'POST',body:JSON.stringify({action})}),
    categories:()=>request<{categories:BookCategory[]}>('/admin/categories'),
    saveCategory:(name:string,parentId:number|null,id?:number)=>request<{category:BookCategory}>(`/admin/categories${id?'/'+id:''}`,{method:id?'PUT':'POST',body:JSON.stringify({name,parentId})}),
    deleteCategory:(id:number)=>request<{ok:boolean}>(`/admin/categories/${id}`,{method:'DELETE'}),
    importOptions:()=>request<{ocr:boolean;maxBytes:number;formats:string[]}>('/admin/imports/options'),
    imports:(id:number)=>request<{imports:BookImport[]}>(`/admin/books/${id}/imports`),
    import:(id:string)=>request<{import:BookImport}>(`/admin/imports/${id}`),
    importPage:(id:string,page:number)=>request<{page:ImportedPage}>(`/admin/imports/${id}/pages/${page}`),
    editImportPage:(id:string,page:ImportedPage)=>request<{page:ImportedPage}>(`/admin/imports/${id}/pages/${page.number}`,{method:'PUT',body:JSON.stringify({heading:page.heading,content:page.content})}),
    cancelImport:(id:string)=>request<{ok:boolean}>(`/admin/imports/${id}`,{method:'DELETE'}),
    applyImport:(id:string,startPage:number)=>request<{bookId:number;added:number}>(`/admin/imports/${id}/apply`,{method:'POST',body:JSON.stringify({startPage})}),
    uploadDocument:async(bookId:number,files:File[],mode:string)=>{
      const body=new FormData();body.append('mode',mode);files.forEach(file=>body.append('files',file));
      const response=await fetch(`${BASE_URL}/admin/media/import/${bookId}`,{method:'POST',headers:{Authorization:`Bearer ${getToken()||''}`},body});
      const result=await response.json().catch(()=>({error:'بارگذاری کامل نشد. مجموع فایل‌ها باید حداکثر ۳۰ مگابایت باشد.'}));if(!response.ok)throw new ApiError(result.error,response.status);return result as {import:BookImport};
    },
    savePage: (bookId: number, page: Pick<LibraryPage,'number'|'heading'|'content'|'keywords'|'audioAssetId'|'audioCues'|'imageAssetId'|'visualMode'>) => request<{page:LibraryPage}>(`/admin/books/${bookId}/pages/${page.number}`, {method:'PUT',body:JSON.stringify(page)}),
    deletePage: (bookId: number, page: number) => request<{ok:boolean}>(`/admin/books/${bookId}/pages/${page}`, {method:'DELETE'}),
    access: () => request<{grants:AdminGrant[]}>('/admin/access'),
    addAdmin: (identifier: string) => request<{grant:AdminGrant}>('/admin/access', {method:'POST',body:JSON.stringify({identifier})}),
    removeAdmin: (id:number) => request<{ok:boolean}>(`/admin/access/${id}`, {method:'DELETE'}),
    upload: async (kind: 'cover'|'audio'|'page-image', file: File) => {
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
