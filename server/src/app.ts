import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';
import path from 'path';
import {installClientRoutes} from './clientRoutes';
import { validatePreproductionConfig } from './config/preproduction';

const app = express();
validatePreproductionConfig();
if (config.preproduction) app.set('trust proxy', 'loopback');

app.use(helmet(config.preproduction ? {
  contentSecurityPolicy: { directives: {
    scriptSrc: ["'self'", 'https://telegram.org'],
    imgSrc: ["'self'", 'data:', 'blob:'],
    mediaSrc: ["'self'", 'blob:'],
    frameAncestors: ["'self'", 'https://web.telegram.org', 'https://*.telegram.org'],
  } },
  xFrameOptions: false,
} : undefined));
app.use(cors({ origin: new URL(config.frontendUrl).origin, credentials: true }));
// This disables capture APIs initiated by our own pages. It cannot control OS
// recorders or browser extensions, which run outside this document's policy.
app.use((_req,res,next)=>{res.setHeader('Permissions-Policy','display-capture=(), microphone=(), camera=(), geolocation=()');res.setHeader('Referrer-Policy','same-origin');next();});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'bonbook', ...(config.preproduction ? { environment: 'preproduction' } : {}) });
});

// Static assets and SPA documents must remain available when an API budget is exhausted.
app.use('/api', generalLimiter, routes);

if (config.preproduction) {
  const clientDirectory = path.resolve(__dirname, '../../client/dist-preproduction');
  installClientRoutes(app,clientDirectory);
}

app.use(errorHandler);

if (config.nodeEnv !== 'test') {
  const onListening = () => {
    console.log(`BonBook server running on port ${config.port}`);
  };
  if (config.nodeEnv === 'development' && config.localTelegramLogin) {
    app.listen(config.port, '127.0.0.1', onListening);
  } else if (config.host) {
    app.listen(config.port, config.host, onListening);
  } else {
    app.listen(config.port, onListening);
  }
}

export default app;
