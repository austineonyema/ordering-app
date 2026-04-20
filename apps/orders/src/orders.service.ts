import { Inject, Injectable, Logger } from '@nestjs/common';
import { OrderCreatedEvent } from '@app/common';
import { CreateOrderRequest } from './dto/create-order.dto';
import { OrdersRepository } from './orders.repository';
import { BILLING_SERVICE } from './constants/services';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { Types } from 'mongoose';
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject() private readonly ordersRepository: OrdersRepository,
    @Inject(BILLING_SERVICE) private billingClient: ClientProxy,
  ) {}

  async getOrders() {
    return await this.ordersRepository.find({});
  }

  async createOrder(
    request: CreateOrderRequest,
    user_id: string,
    authorization?: string,
  ) {
    const session = await this.ordersRepository.startTransaction();

    this.logger.log(
      {
        userId: user_id,
        action: 'create-order',
      },
      'Order creation requested',
    );

    try {
      const order = await this.ordersRepository.create(
        { ...request, userId: new Types.ObjectId(user_id) },
        { session },
      );

      this.logger.log(
        {
          userId: user_id,
          orderId: order._id?.toString(),
          action: 'create-order',
        },
        'Order persisted',
      );

      const eventPayload: OrderCreatedEvent = {
        request,
        Authorization: authorization ?? '',
      };
      await lastValueFrom(
        this.billingClient.emit('order_created', eventPayload),
      );
      await session.commitTransaction();
      this.logger.log(
        {
          userId: user_id,
          orderId: order._id?.toString(),
          action: 'create-order',
        },
        'Order created successfully',
      );
      return order;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    }
  }

  async getUserOrders(userId: string) {
    // async getUserOrders(userId: string, user: PlainAuth) {
    return await this.ordersRepository.find({
      userId: new Types.ObjectId(userId),
    });
  }
}
