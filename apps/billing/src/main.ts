import { NestFactory } from '@nestjs/core';
import { RmqService } from '@app/common';
import { BillingModule } from './billing.module';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(BillingModule, { bufferLogs: true });
  const rmqService = app.get<RmqService>(RmqService);
  app.connectMicroservice(rmqService.getOptions('BILLING'));
  app.useGlobalInterceptors(new LoggerErrorInterceptor());
  app.useLogger(app.get(Logger));
  await app.startAllMicroservices();
  // app.useGlobalPipes(
  //   new ValidationPipe({
  //     whitelist: true,
  //     forbidNonWhitelisted: true,
  //     transform: true,
  //   }),
  // );
}
void bootstrap();
