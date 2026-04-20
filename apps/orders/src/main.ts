import { NestFactory } from '@nestjs/core';
import { OrdersModule } from './orders.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(OrdersModule, { bufferLogs: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new LoggerErrorInterceptor());
  app.useLogger(app.get(Logger));
  const configService = app.get(ConfigService);
  await app.listen(configService.getOrThrow('PORT') || 3000, '0.0.0.0');
}
void bootstrap();
