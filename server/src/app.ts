import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';
import path from 'path';
import fs from 'fs';
import { validatePreproductionConfig } from './config/preproduction';

const app = express();
validatePreproductionConfig();
if (config.preproduction) app.set('trust proxy', 'loopback');

app.use(helmet(config.preproduction ? {
  contentSecurityPolicy: { directives: {
    scriptSrc: ["'self'", 'https://telegram.org'],
    frameAncestors: ["'self'", 'https://web.telegram.org', 'https://*.telegram.org'],
  } },
  xFrameOptions: false,
} : undefined));
app.use(cors({ origin: new URL(config.frontendUrl).origin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'bonbook', ...(config.preproduction ? { environment: 'preproduction' } : {}) });
});

app.use('/api', routes);

if (config.preproduction) {
  const clientDirectory = path.resolve(__dirname, '../../client/dist-preproduction');
  if (!fs.existsSync(path.join(clientDirectory, 'index.html'))) {
    throw new Error('Build the preproduction client before starting the server.');
  }
  app.use(express.static(clientDirectory, { index: 'index.html', dotfiles: 'deny', etag: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
    },
  }));
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
