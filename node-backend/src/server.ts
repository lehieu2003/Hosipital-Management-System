import { createApp } from './app.js';
import { appConfig } from './shared/configs/app.config.js';
import { logger } from './shared/utils/logger.js';

const app = createApp();

app.listen(appConfig.PORT, () => {
  logger.info({ port: appConfig.PORT }, 'server_started');
});
