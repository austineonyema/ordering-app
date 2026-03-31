import { NestFactory } from '@nestjs/core';
import { BillingModule } from './billing.module';

async function bootstrap() {
  const app = await NestFactory.create(BillingModule);
  await app.listen(Number(process.env.PORT ?? process.env.port ?? 3000));
}
void bootstrap();
