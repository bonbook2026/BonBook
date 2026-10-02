// Set these before loading app/config; dotenv does not override existing values.
process.env.NODE_ENV = 'development';
process.env.ENABLE_LOCAL_TELEGRAM_LOGIN = 'true';

require('./app');
