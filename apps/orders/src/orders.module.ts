import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ConfigModule } from '@nestjs/config';
import Joi from 'joi';
import { DatabaseModule } from '@app/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrdersSchema } from './schemas/order.schema';
import { OrdersRepository } from './orders.repository';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        MONGO_DATABASE_URL: Joi.string().required(),
        ORDERS_SERVICE_PORT: Joi.number().required(),
      }),
      envFilePath:
        // [
        'apps/orders/.env',
      // 'apps/orders/.env.docker'],
    }),
    DatabaseModule,
    MongooseModule.forFeature([
      {
        name: Order.name,
        schema: OrdersSchema,
      },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
