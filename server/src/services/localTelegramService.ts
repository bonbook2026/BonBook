import { Request } from 'express';
import { config } from '../config';

export const LOCAL_TELEGRAM_ID = 'local:telegram:bonbook';

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const loopbackAddresses = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function isLocalTelegramRequest(req: Request): boolean {
  if (config.nodeEnv !== 'development' || !config.localTelegramLogin) return false;
  if (!loopbackAddresses.has(req.socket.remoteAddress || '')) return false;
  if (!loopbackHosts.has(req.hostname)) return false;

  const origin = req.get('origin');
  if (origin) {
    try {
      if (!loopbackHosts.has(new URL(origin).hostname)) return false;
    } catch {
      return false;
    }
  }

  return true;
}
