import { createApp } from '@/app';
import { appConfig } from '@/shared/configs/app.config';
import { logger } from '@/shared/utils/logger';

const app = createApp();

app.listen(appConfig.PORT, () => {
  logger.info({ port: appConfig.PORT }, 'server_started');
});
