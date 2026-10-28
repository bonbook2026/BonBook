type IconName = 'book' | 'home' | 'orders' | 'user' | 'arrow' | 'plus' | 'mail' | 'search' | 'play' | 'pause' | 'headphones' | 'shield' | 'shop' | 'chevron' | 'stop' | 'bookmark' | 'expand' | 'sun' | 'moon' | 'close' | 'replay' | 'next';

const paths: Record<IconName, string> = {
  bookmark:'M6 3h12v18l-6-4-6 4V3z',
  expand:'M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6',
  sun:'M16 12a4 4 0 11-8 0 4 4 0 018 0zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  moon:'M21 14.5A9 9 0 019.5 3 9 9 0 1021 14.5z',
  close:'M6 6l12 12M6 18L18 6',
  replay:'M4 10a8 8 0 112 8M4 3v7h7',
  next:'M7 5l10 7-10 7V5zM20 5v14',
  search: 'M21 21l-5.2-5.2M18 10.5a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z',
  play: 'M8 5v14l11-7L8 5z',
  pause: 'M8 5v14M16 5v14',
  headphones: 'M4 14v-3a8 8 0 0116 0v3M4 13h3v8H4v-8zm13 0h3v8h-3v-8z',
  shield: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3zM9 12l2 2 4-4',
  shop: 'M3 10l2-6h14l2 6M3 10h18M5 10v11h14V10M9 21v-7h6v7',
  chevron: 'M15 5l-7 7 7 7',
  stop: 'M6 6h12v12H6V6z',
  book: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  orders: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6m-6 4h4',
  user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  arrow: 'M19 12H5m6-6l-6 6 6 6',
  plus: 'M12 5v14m-7-7h14',
  mail: 'M3 6h18v12H3V6zm0 0l9 7 9-7',
};

export function Icon({ name, className = 'w-6 h-6' }: { name: IconName; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={paths[name]} />
    </svg>
  );
}
