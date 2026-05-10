import { NestFactory } from '@nestjs/core';
import { NotificationsModule } from './notifications.module';

import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import { RmqService } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(NotificationsModule, {
    bufferLogs: true,
  });
  const rmqService = app.get<RmqService>(RmqService);
  app.connectMicroservice(rmqService.getOptions('BILLING'));
  app.useGlobalInterceptors(new LoggerErrorInterceptor());
  app.useLogger(app.get(Logger));
  await app.startAllMicroservices();
}
void bootstrap();
