import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'bonbook' });
});

app.use('/api', routes);

app.use(errorHandler);

if (config.nodeEnv !== 'test') {
  const onListening = () => {
    console.log(`BonBook server running on port ${config.port}`);
  };
  if (config.nodeEnv === 'development' && config.localTelegramLogin) {
    app.listen(config.port, '127.0.0.1', onListening);
  } else {
    app.listen(config.port, onListening);
  }
}

export default app;
