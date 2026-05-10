import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AuthModule, LoggingModule, RmqModule } from '@app/common';
import { ConfigModule } from '@nestjs/config';
import Joi from 'joi';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        RABBIT_MQ_URI: Joi.string().required(),
        RABBIT_MQ_BILLING_QUEUE: Joi.string().required(),
        AUTH_JWT_PUBLIC_KEY: Joi.string().required(),
      }),
      envFilePath: ['apps/billing/.env', './apps/billing/.env'],
    }),
    RmqModule,
    AuthModule,
    LoggingModule.register({
      serviceName: 'notification',
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
