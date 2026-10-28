// Load the isolated environment before importing the application.
process.env.NODE_ENV = 'production';
process.env.APP_ENV = 'preproduction';
process.env.ENABLE_LOCAL_TELEGRAM_LOGIN = 'false';
process.env.BONBOOK_ENV_FILE ||= require('path').resolve(__dirname, '../.env.preproduction');

require('./app');
