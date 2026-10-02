import { useEffect, useState } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
        themeParams: Record<string, string>;
        colorScheme: 'light' | 'dark';
      };
    };
  }
}

export function useTelegram() {
  const [isReady, setIsReady] = useState(false);

  const tg = window.Telegram?.WebApp;

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      setIsReady(true);
    }
  }, [tg]);

  return {
    tg,
    isReady,
    initData: tg?.initData || '',
    user: tg?.initDataUnsafe?.user,
  };
}
