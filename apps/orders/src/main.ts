import { NestFactory } from '@nestjs/core';
import { OrdersModule } from './orders.module';

async function bootstrap() {
  const app = await NestFactory.create(OrdersModule);
  await app.listen(Number(process.env.PORT ?? process.env.port ?? 3000));
}
void bootstrap();
