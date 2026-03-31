import { NestFactory } from '@nestjs/core';
import { AuthModule } from './auth.module';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule);
  await app.listen(Number(process.env.PORT ?? process.env.port ?? 3000));
}
void bootstrap();
