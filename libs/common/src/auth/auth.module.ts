import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { existsSync, readFileSync } from 'fs';
import { JwtAuthGuard } from './jwt-auth.guard';

export function normalizePemKey(value: string) {
  const normalizedValue = value.trim();

  if (existsSync(normalizedValue)) {
    return readFileSync(normalizedValue, 'utf8');
  }

  return normalizedValue.replace(/\\n/g, '\n');
}

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        publicKey: normalizePemKey(
          configService.getOrThrow<string>('AUTH_JWT_PUBLIC_KEY'),
        ),
        verifyOptions: {
          algorithms: ['RS256'],
        },
      }),
    }),
  ],
  providers: [JwtAuthGuard],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
